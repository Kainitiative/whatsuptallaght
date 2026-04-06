import { getSettingValue } from "../routes/settings";
import { logger } from "./logger";

const GRAPH_API_BASE = "https://graph.facebook.com/v20.0";

/**
 * Derives a Page Access Token from the stored token.
 * Works whether the stored token is a User token or already a Page token.
 * A Page token is required to post to /{pageId}/feed.
 */
async function resolvePageToken(pageId: string, storedToken: string): Promise<string | null> {
  const res = await fetch(
    `${GRAPH_API_BASE}/${pageId}?fields=access_token&access_token=${storedToken}`
  );
  const data = await res.json() as { access_token?: string; id?: string; error?: { message: string; code: number } };

  if (data.access_token) {
    logger.debug({ pageId }, "Resolved Page Access Token from User token");
    return data.access_token;
  }

  logger.debug(
    { pageId, graphError: data.error },
    "Could not derive Page token — using stored token directly"
  );
  return storedToken;
}

/**
 * Posts a published article to the configured Facebook Page.
 *
 * Strategy:
 *  - If we have an article image (submitted WhatsApp photo preferred, AI header fallback),
 *    post it via /{pageId}/photos so the correct image always appears regardless of
 *    OG meta scraping.  The article URL is embedded prominently in the caption.
 *  - If no image is available, fall back to a plain link-share post via /{pageId}/feed.
 *
 * Fire-and-forget safe — all errors are caught and logged, never thrown.
 * Returns the Facebook post ID on success, null otherwise.
 */
export async function postToFacebookPage(post: {
  title: string;
  slug: string;
  excerpt?: string | null;
  overrideMessage?: string;
  headerImageUrl?: string | null;
  bodyImages?: string[] | null;
}): Promise<string | null> {
  try {
    const [pageId, storedToken, platformUrl] = await Promise.all([
      getSettingValue("facebook_page_id"),
      getSettingValue("facebook_page_access_token"),
      getSettingValue("platform_url"),
    ]);

    if (!pageId || !storedToken) {
      logger.info("Facebook posting skipped — page ID or token not configured");
      return null;
    }

    const pageToken = await resolvePageToken(pageId, storedToken);
    if (!pageToken) {
      logger.warn({ pageId }, "Facebook posting skipped — could not resolve Page token");
      return null;
    }

    const base = (platformUrl ?? "https://whatsuptallaght.ie").replace(/\/$/, "");
    const articleUrl = `${base}/article/${post.slug}`;

    // Build caption — use AI-generated Facebook caption when available
    const captionBody = post.overrideMessage
      ? post.overrideMessage
      : post.excerpt
        ? post.excerpt
        : post.title;

    const caption = `${captionBody}\n\n🔗 Read the full story: ${articleUrl}`;

    // --- Pick the best image to post ---
    // Prefer the submitted WhatsApp photo (authentic), then the AI-generated header.
    const bodyImgs: string[] = Array.isArray(post.bodyImages) ? (post.bodyImages as string[]) : [];
    const rawImagePath = bodyImgs[0] ?? post.headerImageUrl ?? null;
    const imageUrl = rawImagePath
      ? rawImagePath.startsWith("http")
        ? rawImagePath
        : `${base}${rawImagePath}`
      : null;

    // --- Post with image (preferred) ---
    if (imageUrl) {
      const photoRes = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: imageUrl,
          caption,
          access_token: pageToken,
        }),
      });

      const photoResult = await photoRes.json() as { id?: string; post_id?: string; error?: { message: string; code: number; fbtrace_id?: string } };

      if (photoRes.ok && !photoResult.error) {
        const fbId = photoResult.post_id ?? photoResult.id ?? null;
        logger.info({ facebookPostId: fbId, slug: post.slug, imageUrl }, "Article posted to Facebook (photo post)");
        return fbId;
      }

      logger.warn(
        { facebookError: photoResult.error, status: photoRes.status, slug: post.slug },
        "Facebook photo post failed — falling back to link post"
      );
    }

    // --- Fall back to plain link post (no image available or photo post failed) ---
    const feedRes = await fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: caption,
        link: articleUrl,
        access_token: pageToken,
      }),
    });

    const feedResult = await feedRes.json() as { id?: string; error?: { message: string; code: number; fbtrace_id?: string } };

    if (!feedRes.ok || feedResult.error) {
      logger.warn(
        { facebookError: feedResult.error, status: feedRes.status, slug: post.slug },
        "Facebook link post failed"
      );
      return null;
    }

    logger.info({ facebookPostId: feedResult.id, slug: post.slug }, "Article posted to Facebook (link post)");
    return feedResult.id ?? null;
  } catch (err) {
    logger.warn({ err }, "Facebook posting: unexpected error (non-fatal)");
    return null;
  }
}
