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
 * Used as a fallback for link-only posts (no image available).
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

/**
 * Uploads an image to the Facebook Page's photo library (as an unpublished photo)
 * and returns the internal photo ID. This ID can then be used with attached_media
 * on a subsequent feed post so Facebook shows the exact image we want — no OG
 * scraping or caching involved.
 *
 * @param imageUrl  Absolute public URL of the image to upload.
 * @param pageId    Facebook Page ID.
 * @param pageToken Page-scoped access token.
 * @returns         The Facebook photo ID, or null if the upload failed.
 */
async function uploadPhotoToFacebook(
  imageUrl: string,
  pageId: string,
  pageToken: string,
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      url: imageUrl,
      published: "false",
      access_token: pageToken,
    });

    const res = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await res.json() as { id?: string; error?: { message: string; code: number } };

    if (!res.ok || data.error || !data.id) {
      logger.warn({ error: data.error, imageUrl }, "Facebook photo upload failed");
      return null;
    }

    logger.info({ photoId: data.id, imageUrl }, "Facebook photo uploaded successfully");
    return data.id;
  } catch (err) {
    logger.warn({ err, imageUrl }, "Facebook photo upload: unexpected error");
    return null;
  }
}

export type FacebookPostResult =
  | { postId: string; errorDetail?: never }
  | { postId: null; errorDetail: string };

/**
 * Posts a published article to the configured Facebook Page.
 *
 * Strategy:
 *  — If the article has a header image (AI-generated or submitted photo):
 *      1. Upload the image directly to the page's photo library (unpublished).
 *      2. Create a feed post with attached_media referencing the uploaded photo.
 *         The caption includes the article excerpt + the article URL as a clickable link.
 *      This bypasses OG cache entirely and guarantees the correct image is shown.
 *
 *  — If there is no image:
 *      Fall back to a link post (article card). Facebook derives the image from OG tags;
 *      we trigger a rescrape first to maximise the chance of getting the right image.
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

    // Build caption — punchy excerpt or title, followed by the article URL on its own line
    // so Facebook renders it as a clickable link even on a photo post.
    const captionBody = post.overrideMessage
      ? post.overrideMessage
      : post.excerpt
        ? post.excerpt
        : post.title;
    const message = `${captionBody}\n\n${articleUrl}`;

    // Resolve the best available image path to an absolute URL.
    // Priority: submitted WhatsApp photo (bodyImages[0]) > AI-generated header.
    const rawImagePath =
      (Array.isArray(post.bodyImages) && post.bodyImages.length > 0 ? post.bodyImages[0] : null) ??
      post.headerImageUrl ??
      null;

    const absoluteImageUrl = rawImagePath
      ? rawImagePath.startsWith("http")
        ? rawImagePath
        : `${base}${rawImagePath}`
      : null;

    // ---------------------------------------------------------------------------
    // Path A — Photo post (image available): upload directly, no OG dependency
    // ---------------------------------------------------------------------------
    if (absoluteImageUrl) {
      const photoId = await uploadPhotoToFacebook(absoluteImageUrl, pageId, pageToken);

      if (photoId) {
        const feedRes = await fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            attached_media: [{ media_fbid: photoId }],
            access_token: pageToken,
          }),
        });
        const feedData = await feedRes.json() as { id?: string; error?: { message: string; code: number; type?: string } };

        if (feedRes.ok && !feedData.error && feedData.id) {
          logger.info({ facebookPostId: feedData.id, slug: post.slug }, "Article posted to Facebook (photo post with direct image)");
          return { postId: feedData.id };
        }

        // Photo post failed — fall through to link post fallback
        logger.warn({ error: feedData.error, slug: post.slug }, "Facebook photo feed post failed, falling back to link post");
      }
    }

    // ---------------------------------------------------------------------------
    // Path B — Text post fallback (no image, or photo upload failed)
    //
    // We deliberately do NOT use `link:` here. Using `link:` causes Facebook to
    // render an OG preview card — and if the article has no real header image the
    // OG scraper picks up the site's generic placeholder, making every imageless
    // post look identical. Instead we embed the URL in the message text; Facebook
    // still renders it as a clickable hyperlink but without an image card.
    // ---------------------------------------------------------------------------

    const fallbackCaption = post.overrideMessage
      ? post.overrideMessage
      : post.excerpt
        ? post.excerpt
        : post.title;

    // URL appended to the caption — Facebook renders it as a clickable link
    const linkMessage = `${fallbackCaption}\n\n${articleUrl}`;

    const feedRes = await fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: linkMessage,
        access_token: pageToken,
      }),
    });
    const feedData = await feedRes.json() as { id?: string; error?: { message: string; code: number; type?: string } };

    if (!feedRes.ok || feedData.error) {
      const e = feedData.error;
      const detail = e
        ? `Facebook API error (code ${e.code}): ${e.message}`
        : `Facebook returned HTTP ${feedRes.status}`;
      logger.warn({ facebookError: e, status: feedRes.status, slug: post.slug }, "Facebook text post failed");
      return { postId: null, errorDetail: detail };
    }

    logger.info({ facebookPostId: feedData.id, slug: post.slug }, "Article posted to Facebook (text post, no image)");
    const resultPostId = feedData.id ?? null;
    if (resultPostId === null) {
      return { postId: null, errorDetail: "Facebook returned no post ID" };
    }
    return { postId: resultPostId };

  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    logger.warn({ err }, "Facebook posting: unexpected error (non-fatal)");
    return { postId: null, errorDetail: `Unexpected error: ${detail}` };
  }
}

/**
 * Posts a business directory listing introduction to the configured Facebook Page.
 */
export async function postBusinessToFacebook(business: {
  name: string;
  slug: string;
  facebookPostText: string;
  logoUrl?: string | null;
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
    const directoryUrl = `${base}/directory/${business.slug}`;
    const message = `${business.facebookPostText}\n\n${directoryUrl}\n\n📲 Want to list your business? Send us a WhatsApp: https://wa.me/353894366696`;

    const absoluteLogoUrl = business.logoUrl
      ? business.logoUrl.startsWith("http")
        ? business.logoUrl
        : `${base}${business.logoUrl}`
      : null;

    if (absoluteLogoUrl) {
      const photoId = await uploadPhotoToFacebook(absoluteLogoUrl, pageId, pageToken);
      if (photoId) {
        const feedRes = await fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            attached_media: [{ media_fbid: photoId }],
            access_token: pageToken,
          }),
        });
        const feedData = await feedRes.json() as { id?: string; error?: { message: string; code: number } };
        if (feedRes.ok && !feedData.error && feedData.id) {
          logger.info({ facebookPostId: feedData.id, slug: business.slug }, "Business posted to Facebook (photo post)");
          return { postId: feedData.id };
        }
        logger.warn({ error: feedData.error, slug: business.slug }, "Business FB photo post failed, falling back");
      }
    }

    const feedRes = await fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, access_token: pageToken }),
    });
    const feedData = await feedRes.json() as { id?: string; error?: { message: string; code: number } };
    if (!feedRes.ok || feedData.error) {
      const e = feedData.error;
      return { postId: null, errorDetail: e ? `Facebook API error (code ${e.code}): ${e.message}` : `HTTP ${feedRes.status}` };
    }
    logger.info({ facebookPostId: feedData.id, slug: business.slug }, "Business posted to Facebook (text post)");
    return { postId: feedData.id ?? null };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    logger.warn({ err }, "Business Facebook posting: unexpected error");
    return { postId: null, errorDetail: `Unexpected error: ${detail}` };
  }
}
