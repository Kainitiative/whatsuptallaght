/**
 * Entity Matcher — scans article text for known entity names / aliases
 * and returns the first matched entity (with its image URL).
 *
 * Matching is pure string-based (case-insensitive whole-word check).
 * No GPT call needed — keeps cost and latency low.
 */
import { db } from "@workspace/db";
import { entitiesTable } from "@workspace/db/schema";
import { logger } from "./logger";

export interface EntityMatch {
  entityId: number;
  entityName: string;
  entityImageUrl: string | null;
  matchedOn: string;
}

/**
 * Find the first entity (by name or alias) mentioned in the article body.
 * Returns null if no entities exist or none are matched.
 */
export async function matchEntityInArticle(
  articleText: string,
): Promise<EntityMatch | null> {
  try {
    const entities = await db.select().from(entitiesTable);
    if (entities.length === 0) return null;

    const normalised = articleText.toLowerCase();

    for (const entity of entities) {
      const names = [entity.name, ...(entity.aliases ?? [])];
      for (const name of names) {
        if (!name?.trim()) continue;
        const lower = name.toLowerCase();
        // Whole-word match — avoids partial hits like "GAA" inside "Garda"
        const pattern = new RegExp(`\\b${escapeRegex(lower)}\\b`);
        if (pattern.test(normalised)) {
          logger.info(
            { entityId: entity.id, entityName: entity.name, matchedOn: name },
            "Entity matcher: entity found in article",
          );
          return {
            entityId: entity.id,
            entityName: entity.name,
            entityImageUrl: entity.imageUrl,
            matchedOn: name,
          };
        }
      }
    }

    return null;
  } catch (err) {
    logger.warn({ err }, "Entity matcher: error during matching (non-fatal)");
    return null;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
