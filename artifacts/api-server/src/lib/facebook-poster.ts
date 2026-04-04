import { getSettingValue } from "../routes/settings";
import { logger } from "./logger";

const GRAPH_API_BASE = "https://graph.facebook.com/v20.0";

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
    const [pageId, pageToken, siteUrl] = await Promise.all([
      getSettingValue("facebook_page_id"),
      getSettingValue("facebook_page_access_token"),
      getSettingValue("site_url"),
    ]);

    if (!pageId || !pageToken) {
      logger.info("Facebook posting skipped — page ID or token not configured");
      return null;
    }

    const base = (siteUrl ?? "https://whatsuptallaght.ie").replace(/\/$/, "");
    const articleUrl = `${base}/article/${post.slug}`;

    // Message above the link preview card
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

    const result = await response.json() as { id?: string; error?: { message: string; code: number } };

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
