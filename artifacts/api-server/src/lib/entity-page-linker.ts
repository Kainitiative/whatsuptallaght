/**
 * Entity Page Linker — scans a published article for mentions of entity page
 * names and aliases, then inserts rows into entity_page_articles so that each
 * matching entity page's "Recent Coverage" section stays up to date.
 *
 * Unlike the entity-matcher (which finds ONE central entity for image selection),
 * this linker finds ALL published entity pages that are mentioned — a single
 * article can be linked to several entity pages.
 *
 * Matching rules:
 *  - Case-insensitive whole-word match on the entity page's primary name.
 *  - Case-insensitive whole-word match on any of its aliases.
 *  - An article is only linked once per entity page even if both name and alias hit.
 *  - Errors are non-fatal; failures are logged but do not block article publishing.
 */

import { db } from "@workspace/db";
import { entityPagesTable, entityPageArticlesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wholeWordMatch(text: string, term: string): boolean {
  if (!term?.trim()) return false;
  const pattern = new RegExp(`\\b${escapeRegex(term.toLowerCase())}\\b`);
  return pattern.test(text);
}

export async function linkEntityPagesToPost(
  postId: number,
  articleText: string,
): Promise<void> {
  try {
    const pages = await db
      .select({
        id: entityPagesTable.id,
        name: entityPagesTable.name,
        aliases: entityPagesTable.aliases,
      })
      .from(entityPagesTable)
      .where(eq(entityPagesTable.status, "published"));

    if (pages.length === 0) return;

    const normalised = articleText.toLowerCase();
    const matchedPageIds: number[] = [];

    for (const page of pages) {
      const nameHit = wholeWordMatch(normalised, page.name);
      const aliasHit = !nameHit && (page.aliases ?? []).some((a) => wholeWordMatch(normalised, a));

      if (nameHit || aliasHit) {
        matchedPageIds.push(page.id);
        logger.info(
          { postId, entityPageId: page.id, entityPageName: page.name, matchedOn: nameHit ? page.name : "alias" },
          "Entity page linker: match found",
        );
      }
    }

    if (matchedPageIds.length === 0) return;

    for (const entityPageId of matchedPageIds) {
      // Upsert-style: only insert if the link doesn't already exist
      const existing = await db
        .select({ entityPageId: entityPageArticlesTable.entityPageId })
        .from(entityPageArticlesTable)
        .where(
          and(
            eq(entityPageArticlesTable.entityPageId, entityPageId),
            eq(entityPageArticlesTable.postId, postId),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(entityPageArticlesTable).values({ entityPageId, postId });
      }
    }

    logger.info(
      { postId, linkedEntityPageIds: matchedPageIds },
      "Entity page linker: complete",
    );
  } catch (err) {
    logger.warn({ err, postId }, "Entity page linker: error during linking (non-fatal)");
  }
}
