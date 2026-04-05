/**
 * Entity Matcher — scans article text for known entity names / aliases,
 * then verifies the matched entity is CENTRAL to the story (not just a mention).
 *
 * Priority order for string matching:
 *   1. Full primary-name match  — highest priority
 *   2. Alias match              — lower priority
 *   3. Partial / substring hit  — ignored entirely
 *
 * Centrality check (GPT-4o-mini, ~50 tokens):
 *   After finding the best string match, a cheap AI call decides whether
 *   the entity is the main subject of the article. If it is only mentioned
 *   in passing, the match is discarded and no entity image is applied.
 *   If the AI call fails for any reason, we fail open (match is kept).
 */
import type OpenAI from "openai";
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
  /** Whether the centrality check confirmed this entity is the story's main subject */
  isCentral: boolean;
}

/**
 * Return the best entity match found in the article text, or null.
 *
 * Pass 1 — primary names only (whole-word).
 * Pass 2 — aliases only (whole-word), skipped when Pass 1 found something.
 *
 * If `openai` is supplied, runs a centrality check after finding a string
 * match. Returns null when the entity is only mentioned in passing.
 * If `openai` is not supplied, the centrality check is skipped.
 */
export async function matchEntityInArticle(
  articleText: string,
  openai?: OpenAI,
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
          isCentral: false,
        });
      }
    }

    // --- Pass 2: alias matches (only when no primary-name match) ---
    let candidates: EntityMatch[] = [];

    if (nameMatches.length > 0) {
      // Longest primary-name match wins
      candidates = [nameMatches.sort((a, b) => b.matchedOn.length - a.matchedOn.length)[0]];
    } else {
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
              isCentral: false,
            });
            break; // one alias per entity
          }
        }
      }
      if (aliasMatches.length > 0) {
        // Longest alias match wins
        candidates = [aliasMatches.sort((a, b) => b.matchedOn.length - a.matchedOn.length)[0]];
      }
    }

    if (candidates.length === 0) return null;

    const best = candidates[0];

    // --- Centrality check (requires OpenAI) ---
    if (openai) {
      const central = await isCentralToStory(openai, best.entityName, articleText);
      if (!central) {
        logger.info(
          { entityId: best.entityId, entityName: best.entityName, matchedOn: best.matchedOn },
          "Entity matcher: entity found but NOT central to story — image suppressed",
        );
        return null;
      }
      best.isCentral = true;
    }

    logger.info(
      {
        entityId: best.entityId,
        entityName: best.entityName,
        matchedOn: best.matchedOn,
        priority: best.matchPriority,
        centralityChecked: !!openai,
      },
      "Entity matcher: match accepted",
    );
    return best;
  } catch (err) {
    logger.warn({ err }, "Entity matcher: error during matching (non-fatal)");
    return null;
  }
}

/**
 * Ask GPT-4o-mini whether the entity is the MAIN SUBJECT of the article.
 * Returns true if central, false if only mentioned in passing.
 * Fails open — returns true on any error (better to over-match than miss).
 */
async function isCentralToStory(
  openai: OpenAI,
  entityName: string,
  articleText: string,
): Promise<boolean> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 20,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You decide if a named entity is the MAIN SUBJECT of a news article, or just mentioned in passing. " +
            'Respond ONLY with JSON: {"central": true} or {"central": false}. ' +
            '"central" means the article is primarily ABOUT the entity — not just that it appears once in the text.',
        },
        {
          role: "user",
          content: `Entity: "${entityName}"\n\nArticle:\n${articleText.slice(0, 800)}`,
        },
      ],
    });

    const raw = response.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(raw);
    return parsed.central === true;
  } catch (err) {
    // Fail open — if the check errors, assume central so we don't suppress valid matches
    logger.warn({ err, entityName }, "Entity matcher: centrality check failed — failing open");
    return true;
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
