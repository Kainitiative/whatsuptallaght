import { getSettingValue } from "../routes/settings";
import { logger } from "./logger";

const GRAPH_API_BASE = "https://graph.facebook.com/v20.0";

/**
 * Derives a Page Access Token from the stored token.
 * Works whether the stored token is a User token or already a Page token.
 */
async function resolvePageToken(pageId: string, storedToken: string): Promise<string> {
  try {
    const res = await fetch(
      `${GRAPH_API_BASE}/${pageId}?fields=access_token&access_token=${storedToken}`
    );
    const data = await res.json() as { access_token?: string; error?: { message: string; code: number } };
    if (data.access_token) {
      logger.debug({ pageId }, "Resolved Page Access Token from User token");
      return data.access_token;
    }
  } catch {
    // ignore, fall through
  }
  logger.debug({ pageId }, "Using stored token directly as Page token");
  return storedToken;
}

/**
 * Tells Facebook to re-scrape an article URL so its OG cache is refreshed.
 * We do this BEFORE posting the link so the article card shows the correct
 * image, title and description immediately.
 */
async function triggerOgRescrape(articleUrl: string, pageToken: string): Promise<void> {
  try {
    const res = await fetch(
      `${GRAPH_API_BASE}/?id=${encodeURIComponent(articleUrl)}&scrape=true&access_token=${pageToken}`,
      { method: "POST" }
    );
    const data = await res.json() as { og_object?: { id: string }; error?: unknown };
    if (data.og_object) {
      logger.info({ articleUrl }, "Facebook OG cache refreshed");
    } else {
      logger.debug({ articleUrl, data }, "Facebook OG rescrape returned unexpected response");
    }
  } catch (err) {
    logger.debug({ articleUrl, err }, "Facebook OG rescrape failed (non-fatal)");
  }
}

export type FacebookPostResult =
  | { postId: string; errorDetail?: never }
  | { postId: null; errorDetail: string };

/**
 * Posts a published article to the configured Facebook Page as a link post.
 *
 * A link post renders as a clickable article card on the timeline — showing the
 * article title, excerpt, header image and a direct link to whatsuptallaght.ie.
 * This is the correct format for a news page and is far more engaging than a
 * photo post with the URL buried in the caption text.
 *
 * Strategy:
 *  1. Trigger an OG rescrape so Facebook's cache has the correct image/title.
 *  2. Post to /{pageId}/feed with `link: articleUrl` — Facebook renders this as
 *     a proper article preview card.
 *  3. The caption above the card is the article excerpt (or title as fallback).
 */
export async function postToFacebookPage(post: {
  title: string;
  slug: string;
  excerpt?: string | null;
  overrideMessage?: string;
  headerImageUrl?: string | null;
  bodyImages?: string[] | null;
}): Promise<FacebookPostResult> {
  try {
    const [pageId, storedToken, platformUrl] = await Promise.all([
      getSettingValue("facebook_page_id"),
      getSettingValue("facebook_page_access_token"),
      getSettingValue("platform_url"),
    ]);

    if (!pageId || !storedToken) {
      return { postId: null, errorDetail: "Facebook page ID or access token not configured in Settings." };
    }

    const pageToken = await resolvePageToken(pageId, storedToken);
    const base = (platformUrl ?? "https://whatsuptallaght.ie").replace(/\/$/, "");
    const articleUrl = `${base}/article/${post.slug}`;

    // Build the caption shown above the link card — keep it punchy
    const captionBody = post.overrideMessage
      ? post.overrideMessage
      : post.excerpt
        ? post.excerpt
        : post.title;
    const message = captionBody;

    // Refresh Facebook's OG cache first so the card image/title are correct
    await triggerOgRescrape(articleUrl, pageToken);

    // Post as a link post — renders as a clickable article card on the timeline
    const feedRes = await fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        link: articleUrl,
        access_token: pageToken,
      }),
    });
    const feedData = await feedRes.json() as { id?: string; error?: { message: string; code: number; type?: string } };

    if (!feedRes.ok || feedData.error) {
      const e = feedData.error;
      const detail = e
        ? `Facebook API error (code ${e.code}): ${e.message}`
        : `Facebook returned HTTP ${feedRes.status}`;
      logger.warn({ facebookError: e, status: feedRes.status, slug: post.slug }, "Facebook link post failed");
      return { postId: null, errorDetail: detail };
    }

    logger.info({ facebookPostId: feedData.id, slug: post.slug }, "Article posted to Facebook (link post)");
    return { postId: feedData.id ?? null };

  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    logger.warn({ err }, "Facebook posting: unexpected error (non-fatal)");
    return { postId: null, errorDetail: `Unexpected error: ${detail}` };
  }
}
