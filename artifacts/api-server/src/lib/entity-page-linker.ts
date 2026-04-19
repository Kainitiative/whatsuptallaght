/**
 * Entity Page Linker — scans a published article for mentions of entity page
 * names and aliases, then inserts rows into entity_page_articles so that each
 * matching entity page's "Recent Coverage" section stays up to date.
 *
 * Phase 4C additions:
 *  - findEntityPageHeaderPhoto — returns photos[0] from the first matched entity
 *    page that has photos. Used by the pipeline to skip DALL-E when a real photo
 *    is already available.
 *  - linkEntityPagesToPost now accepts newPhotoUrls — any submitted WhatsApp or
 *    RSS photos that belong to the article. After recording the article link,
 *    these URLs are appended to each matched entity page's photo gallery (deduped).
 *    The gallery on the public site grows automatically with every article.
 *
 * Matching rules:
 *  - Case-insensitive whole-word match on the entity page's primary name.
 *  - Case-insensitive whole-word match on any of its aliases.
 *  - An article is only linked once per entity page even if both name and alias hit.
 *  - Errors are non-fatal; failures are logged but do not block article publishing.
 */

import { db } from "@workspace/db";
import { entityPagesTable, entityPageArticlesTable, entityPageRelationsTable } from "@workspace/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { logger } from "./logger";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wholeWordMatch(text: string, term: string): boolean {
  if (!term?.trim()) return false;
  const pattern = new RegExp(`\\b${escapeRegex(term.toLowerCase())}\\b`);
  return pattern.test(text);
}

/**
 * Find the first published entity page whose name / aliases appear in the
 * article text AND that has at least one photo. Returns the first photo URL,
 * or null if no match.
 *
 * Called by the AI pipeline before DALL-E so real community photos take
 * priority over generated images when available.
 */
export async function findEntityPageHeaderPhoto(articleText: string): Promise<string | null> {
  try {
    const pages = await db
      .select({
        id: entityPagesTable.id,
        name: entityPagesTable.name,
        aliases: entityPagesTable.aliases,
        photos: entityPagesTable.photos,
      })
      .from(entityPagesTable)
      .where(eq(entityPagesTable.status, "published"));

    const normalised = articleText.toLowerCase();

    for (const page of pages) {
      const photos = (page.photos ?? []) as string[];
      if (photos.length === 0) continue;

      const nameHit = wholeWordMatch(normalised, page.name);
      const aliasHit = !nameHit && (page.aliases ?? []).some((a) => wholeWordMatch(normalised, a));

      if (nameHit || aliasHit) {
        logger.info(
          { entityPageId: page.id, entityPageName: page.name, photoUrl: photos[0] },
          "Entity page linker: entity page photo found for header",
        );
        return photos[0];
      }
    }

    return null;
  } catch (err) {
    logger.warn({ err }, "Entity page linker: findEntityPageHeaderPhoto failed (non-fatal)");
    return null;
  }
}

/**
 * Link all matching entity pages to a post, and optionally append new photo
 * URLs to each matched entity page's gallery (Phase 4C photo flow).
 *
 * @param postId       The newly created post ID.
 * @param articleText  Full article body text used for name/alias matching.
 * @param newPhotoUrls Optional list of photo URLs from the article (WhatsApp
 *                     body images or stored RSS feed images) to append to the
 *                     entity page galleries. Existing URLs are never duplicated.
 */
export async function linkEntityPagesToPost(
  postId: number,
  articleText: string,
  newPhotoUrls: string[] = [],
): Promise<void> {
  try {
    const pages = await db
      .select({
        id: entityPagesTable.id,
        name: entityPagesTable.name,
        aliases: entityPagesTable.aliases,
        photos: entityPagesTable.photos,
      })
      .from(entityPagesTable)
      .where(eq(entityPagesTable.status, "published"));

    if (pages.length === 0) return;

    const normalised = articleText.toLowerCase();
    const matchedPages: typeof pages = [];

    for (const page of pages) {
      const nameHit = wholeWordMatch(normalised, page.name);
      const aliasHit = !nameHit && (page.aliases ?? []).some((a) => wholeWordMatch(normalised, a));

      if (nameHit || aliasHit) {
        matchedPages.push(page);
        logger.info(
          { postId, entityPageId: page.id, entityPageName: page.name, matchedOn: nameHit ? page.name : "alias" },
          "Entity page linker: match found",
        );
      }
    }

    if (matchedPages.length === 0) return;

    for (const page of matchedPages) {
      // ── Record the article → entity page link ──────────────────────────────
      const existing = await db
        .select({ entityPageId: entityPageArticlesTable.entityPageId })
        .from(entityPageArticlesTable)
        .where(
          and(
            eq(entityPageArticlesTable.entityPageId, page.id),
            eq(entityPageArticlesTable.postId, postId),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(entityPageArticlesTable).values({ entityPageId: page.id, postId });
      }

      // ── Phase 4C: append new photos to entity page gallery ─────────────────
      if (newPhotoUrls.length > 0) {
        const currentPhotos = (page.photos ?? []) as string[];
        const toAdd = newPhotoUrls.filter((url) => url && !currentPhotos.includes(url));

        if (toAdd.length > 0) {
          const merged = [...currentPhotos, ...toAdd];
          await db
            .update(entityPagesTable)
            .set({ photos: merged, updatedAt: new Date() })
            .where(eq(entityPagesTable.id, page.id));

          logger.info(
            { postId, entityPageId: page.id, entityPageName: page.name, addedPhotos: toAdd },
            "Entity page linker: photos appended to entity page gallery",
          );
        }
      }
    }

    logger.info(
      { postId, linkedEntityPageIds: matchedPages.map((p) => p.id) },
      "Entity page linker: complete",
    );
  } catch (err) {
    logger.warn({ err, postId }, "Entity page linker: error during linking (non-fatal)");
  }
}

/**
 * Scan a published entity page's generated body for mentions of other entity
 * pages. Creates bidirectional rows in entity_page_relations for each match.
 *
 * Called automatically after Generate and on demand via the admin button.
 * Errors are non-fatal.
 */
export async function scanEntityPageRelations(pageId: number): Promise<{ linked: number; skipped: number }> {
  try {
    const [page] = await db
      .select({
        id: entityPagesTable.id,
        name: entityPagesTable.name,
        generatedBody: entityPagesTable.generatedBody,
        shortDescription: entityPagesTable.shortDescription,
      })
      .from(entityPagesTable)
      .where(eq(entityPagesTable.id, pageId));

    if (!page) return { linked: 0, skipped: 0 };

    const haystack = `${page.name} ${page.shortDescription ?? ""} ${page.generatedBody ?? ""}`.toLowerCase();

    // All other entity pages to match against
    const others = await db
      .select({
        id: entityPagesTable.id,
        name: entityPagesTable.name,
        aliases: entityPagesTable.aliases,
      })
      .from(entityPagesTable)
      .where(ne(entityPagesTable.id, pageId));

    let linked = 0;
    let skipped = 0;

    for (const other of others) {
      const nameHit = wholeWordMatch(haystack, other.name);
      const aliasHit = !nameHit && (other.aliases ?? []).some((a) => wholeWordMatch(haystack, a));
      if (!nameHit && !aliasHit) continue;

      // Insert A→B if not exists
      const existsAB = await db
        .select({ id: entityPageRelationsTable.id })
        .from(entityPageRelationsTable)
        .where(
          and(
            eq(entityPageRelationsTable.entityPageId, pageId),
            eq(entityPageRelationsTable.relatedEntityPageId, other.id),
          ),
        )
        .limit(1);

      if (existsAB.length === 0) {
        await db.insert(entityPageRelationsTable).values({
          entityPageId: pageId,
          relatedEntityPageId: other.id,
        });
        linked++;
        logger.info(
          { entityPageId: pageId, relatedEntityPageId: other.id, relatedName: other.name },
          "Entity page linker: relation created (A→B)",
        );
      } else {
        skipped++;
      }

      // Insert B→A if not exists (bidirectional)
      const existsBA = await db
        .select({ id: entityPageRelationsTable.id })
        .from(entityPageRelationsTable)
        .where(
          and(
            eq(entityPageRelationsTable.entityPageId, other.id),
            eq(entityPageRelationsTable.relatedEntityPageId, pageId),
          ),
        )
        .limit(1);

      if (existsBA.length === 0) {
        await db.insert(entityPageRelationsTable).values({
          entityPageId: other.id,
          relatedEntityPageId: pageId,
        });
        logger.info(
          { entityPageId: other.id, relatedEntityPageId: pageId, relatedName: page.name },
          "Entity page linker: relation created (B→A)",
        );
      }
    }

    return { linked, skipped };
  } catch (err) {
    logger.warn({ err, pageId }, "Entity page linker: scanEntityPageRelations failed (non-fatal)");
    return { linked: 0, skipped: 0 };
  }
}
