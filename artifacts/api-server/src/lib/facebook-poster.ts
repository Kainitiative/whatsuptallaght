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
 * Downloads an image and returns it as a Buffer plus its MIME type.
 * Tries up to two candidate URLs — the full absolute URL first, then the relative path
 * via the platform base URL.
 */
async function downloadImage(imageUrl: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      logger.warn({ imageUrl, status: res.status }, "Image download failed");
      return null;
    }
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const mimeType = contentType.split(";")[0].trim();
    const buffer = Buffer.from(await res.arrayBuffer());
    logger.debug({ imageUrl, bytes: buffer.length, mimeType }, "Image downloaded for Facebook upload");
    return { buffer, mimeType };
  } catch (err) {
    logger.warn({ imageUrl, err }, "Image download threw");
    return null;
  }
}

/**
 * Uploads an image binary to Facebook as an unpublished photo and returns its photo ID.
 * Uploading binary data is far more reliable than passing a URL for Facebook to fetch.
 */
async function uploadImageToFacebook(
  pageId: string,
  pageToken: string,
  buffer: Buffer,
  mimeType: string
): Promise<string | null> {
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const form = new FormData();
  form.append("source", new Blob([buffer], { type: mimeType }), `article.${ext}`);
  form.append("published", "false"); // upload only, not a post yet
  form.append("access_token", pageToken);

  const res = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
    method: "POST",
    body: form,
  });
  const data = await res.json() as { id?: string; error?: { message: string; code: number } };

  if (res.ok && data.id && !data.error) {
    logger.debug({ photoId: data.id }, "Image uploaded to Facebook (unpublished)");
    return data.id;
  }
  logger.warn({ facebookError: data.error, status: res.status }, "Facebook image upload failed");
  return null;
}

/**
 * Tells Facebook to re-scrape an article URL so its OG cache is refreshed.
 * Best-effort — errors are logged but not thrown.
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
 * Posts a published article to the configured Facebook Page.
 *
 * Strategy:
 *  1. Download the article image locally (avoids Facebook remote-fetch issues with
 *     internal storage URLs).
 *  2. Upload as unpublished photo, then publish it as a page post via /{pageId}/feed
 *     with `attached_media` — this ensures the correct image always appears.
 *  3. If image handling fails, fall back to a plain link post via /{pageId}/feed.
 *  4. After every successful post, trigger an OG rescrape so future link shares show
 *     the right image.
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

    // Build caption
    const captionBody = post.overrideMessage
      ? post.overrideMessage
      : post.excerpt
        ? post.excerpt
        : post.title;
    const message = `${captionBody}\n\n🔗 Read the full story: ${articleUrl}`;

    // Resolve the image URL — prefer WhatsApp submitted photo, then AI header
    const bodyImgs: string[] = Array.isArray(post.bodyImages) ? (post.bodyImages as string[]) : [];
    const rawImagePath = bodyImgs[0] ?? post.headerImageUrl ?? null;
    const imageUrl = rawImagePath
      ? rawImagePath.startsWith("http")
        ? rawImagePath
        : `${base}${rawImagePath}`
      : null;

    // --- Attempt image post ---
    if (imageUrl) {
      const downloaded = await downloadImage(imageUrl);

      if (downloaded) {
        // Upload binary → get a Facebook photo ID
        const photoId = await uploadImageToFacebook(pageId, pageToken, downloaded.buffer, downloaded.mimeType);

        if (photoId) {
          // Publish as a page feed post with the attached photo
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

          if (feedRes.ok && feedData.id && !feedData.error) {
            logger.info(
              { facebookPostId: feedData.id, photoId, slug: post.slug },
              "Article posted to Facebook (binary photo upload)"
            );
            // Refresh OG cache in the background
            void triggerOgRescrape(articleUrl, pageToken);
            return { postId: feedData.id };
          }

          logger.warn(
            { facebookError: feedData.error, status: feedRes.status, photoId, slug: post.slug },
            "Facebook feed post with attached photo failed — falling back to link post"
          );
        }
      } else {
        logger.warn({ imageUrl, slug: post.slug }, "Could not download article image — falling back to link post");
      }
    }

    // --- Fall back to plain link post ---
    void triggerOgRescrape(articleUrl, pageToken); // refresh OG before the link post is indexed

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

    logger.info({ facebookPostId: feedData.id, slug: post.slug }, "Article posted to Facebook (link post fallback)");
    return { postId: feedData.id ?? null };

  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    logger.warn({ err }, "Facebook posting: unexpected error (non-fatal)");
    return { postId: null, errorDetail: `Unexpected error: ${detail}` };
  }
}
