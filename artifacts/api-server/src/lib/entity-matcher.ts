/**
 * Entity Matcher — scans article text for known entity names / aliases.
 *
 * Priority order:
 *   1. Full primary-name match  — highest priority
 *   2. Alias match              — lower priority
 *   3. Partial / substring hit  — ignored entirely (no word-boundary match)
 *
 * When multiple entities match at the same priority level, the one whose
 * matched term is longest wins (more specific beats more generic).
 */
import { db } from "@workspace/db";
import { entitiesTable } from "@workspace/db/schema";
import { logger } from "./logger";

export type MatchPriority = "name" | "alias";

export interface EntityMatch {
  entityId: number;
  entityName: string;
  entityImageUrl: string | null;
  matchedOn: string;
  matchPriority: MatchPriority;
}

/**
 * Return the best entity match found in the article text, or null.
 *
 * Pass 1 — primary name only (whole-word).
 * Pass 2 — aliases only (whole-word), skipped when Pass 1 found something.
 * Partial matches are never returned.
 */
export async function matchEntityInArticle(
  articleText: string,
): Promise<EntityMatch | null> {
  try {
    const entities = await db.select().from(entitiesTable);
    if (entities.length === 0) return null;

    const normalised = articleText.toLowerCase();

    // --- Pass 1: primary name matches ---
    const nameMatches: EntityMatch[] = [];

    for (const entity of entities) {
      if (!entity.name?.trim()) continue;
      if (wholeWordMatch(normalised, entity.name)) {
        nameMatches.push({
          entityId: entity.id,
          entityName: entity.name,
          entityImageUrl: entity.imageUrl,
          matchedOn: entity.name,
          matchPriority: "name",
        });
      }
    }

    if (nameMatches.length > 0) {
      // Prefer longest primary-name match (most specific)
      const best = nameMatches.sort((a, b) => b.matchedOn.length - a.matchedOn.length)[0];
      logger.info(
        { entityId: best.entityId, entityName: best.entityName, matchedOn: best.matchedOn, priority: "name" },
        "Entity matcher: primary-name match",
      );
      return best;
    }

    // --- Pass 2: alias matches (only reached when no primary-name match) ---
    const aliasMatches: EntityMatch[] = [];

    for (const entity of entities) {
      const aliases = entity.aliases ?? [];
      for (const alias of aliases) {
        if (!alias?.trim()) continue;
        if (wholeWordMatch(normalised, alias)) {
          aliasMatches.push({
            entityId: entity.id,
            entityName: entity.name,
            entityImageUrl: entity.imageUrl,
            matchedOn: alias,
            matchPriority: "alias",
          });
          break; // one alias match per entity is enough
        }
      }
    }

    if (aliasMatches.length > 0) {
      // Prefer longest alias match (most specific)
      const best = aliasMatches.sort((a, b) => b.matchedOn.length - a.matchedOn.length)[0];
      logger.info(
        { entityId: best.entityId, entityName: best.entityName, matchedOn: best.matchedOn, priority: "alias" },
        "Entity matcher: alias match",
      );
      return best;
    }

    return null;
  } catch (err) {
    logger.warn({ err }, "Entity matcher: error during matching (non-fatal)");
    return null;
  }
}

/**
 * True only if `term` appears in `text` as a whole word (case-insensitive).
 * Partial / substring matches return false.
 */
function wholeWordMatch(text: string, term: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegex(term.toLowerCase())}\\b`);
  return pattern.test(text);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
