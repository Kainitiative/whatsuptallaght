import { getSettingValue } from "../routes/settings";
import { logger } from "./logger";

const GRAPH_API_BASE = "https://graph.facebook.com/v20.0";

/**
 * Derives a Page Access Token from the stored token.
 * Works whether the stored token is a User token or already a Page token.
 * A Page token is required to post to /{pageId}/feed.
 */
async function resolvePageToken(pageId: string, storedToken: string): Promise<string | null> {
  // Ask Graph API for the page's own access token using the stored token.
  // This works when storedToken is a User token with pages_manage_posts.
  const res = await fetch(
    `${GRAPH_API_BASE}/${pageId}?fields=access_token&access_token=${storedToken}`
  );
  const data = await res.json() as { access_token?: string; id?: string; error?: { message: string; code: number } };

  if (data.access_token) {
    logger.debug({ pageId }, "Resolved Page Access Token from User token");
    return data.access_token;
  }

  // If the call failed, the stored token might already be a Page token — use it directly.
  logger.debug(
    { pageId, graphError: data.error },
    "Could not derive Page token — using stored token directly"
  );
  return storedToken;
}

/**
 * Posts a published article to the configured Facebook Page.
 * Fire-and-forget safe — all errors are caught and logged, never thrown.
 * Returns the Facebook post ID on success, null otherwise.
 */
export async function postToFacebookPage(post: {
  title: string;
  slug: string;
  excerpt?: string | null;
}): Promise<string | null> {
  try {
    const [pageId, storedToken, siteUrl] = await Promise.all([
      getSettingValue("facebook_page_id"),
      getSettingValue("facebook_page_access_token"),
      getSettingValue("site_url"),
    ]);

    if (!pageId || !storedToken) {
      logger.info("Facebook posting skipped — page ID or token not configured");
      return null;
    }

    // Resolve the correct Page Access Token (handles both User and Page tokens)
    const pageToken = await resolvePageToken(pageId, storedToken);
    if (!pageToken) {
      logger.warn({ pageId }, "Facebook posting skipped — could not resolve Page token");
      return null;
    }

    const base = (siteUrl ?? "https://whatsuptallaght.ie").replace(/\/$/, "");
    const articleUrl = `${base}/article/${post.slug}`;

    const message = post.excerpt
      ? `${post.excerpt}\n\n👇 Read the full story on What's Up Tallaght`
      : `👇 Read the full story on What's Up Tallaght`;

    const response = await fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        link: articleUrl,
        access_token: pageToken,
      }),
    });

    const result = await response.json() as { id?: string; error?: { message: string; code: number; fbtrace_id?: string } };

    if (!response.ok || result.error) {
      logger.warn(
        { facebookError: result.error, status: response.status, slug: post.slug },
        "Facebook posting failed"
      );
      return null;
    }

    logger.info({ facebookPostId: result.id, slug: post.slug }, "Article posted to Facebook Page");
    return result.id ?? null;
  } catch (err) {
    logger.warn({ err }, "Facebook posting: unexpected error (non-fatal)");
    return null;
  }
}
