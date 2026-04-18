import { Router } from "express";
import { db } from "@workspace/db";
import { postsTable, categoriesTable, entityPagesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

const BASE_URL = "https://whatsuptallaght.ie";

function xmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(loc: string, lastmod?: string, changefreq?: string, priority?: string): string {
  return [
    "  <url>",
    `    <loc>${xmlEscape(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : "",
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : "",
    priority ? `    <priority>${priority}</priority>` : "",
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

router.get("/robots.txt", (_req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send(
    [
      "User-agent: *",
      "Allow: /",
      "",
      `Sitemap: ${BASE_URL}/sitemap.xml`,
    ].join("\n")
  );
});

router.get("/sitemap.xml", async (_req, res) => {
  try {
    const [articles, categories, entityPages] = await Promise.all([
      db
        .select({ slug: postsTable.slug, publishedAt: postsTable.publishedAt, updatedAt: postsTable.updatedAt })
        .from(postsTable)
        .where(eq(postsTable.status, "published"))
        .orderBy(desc(postsTable.publishedAt)),
      db.select({ slug: categoriesTable.slug, createdAt: categoriesTable.createdAt }).from(categoriesTable),
      db
        .select({ slug: entityPagesTable.slug, updatedAt: entityPagesTable.updatedAt, publishedAt: entityPagesTable.publishedAt })
        .from(entityPagesTable)
        .where(eq(entityPagesTable.status, "published")),
    ]);

    const today = new Date().toISOString().slice(0, 10);

    const staticPages = [
      urlEntry(`${BASE_URL}/`, today, "daily", "1.0"),
      urlEntry(`${BASE_URL}/about`, today, "monthly", "0.5"),
    ];

    const pillarPages = [
      urlEntry(`${BASE_URL}/tallaght-news`, today, "daily", "0.8"),
      urlEntry(`${BASE_URL}/tallaght-community`, today, "daily", "0.8"),
      urlEntry(`${BASE_URL}/whats-on-tallaght`, today, "daily", "0.8"),
      urlEntry(`${BASE_URL}/events`, today, "daily", "0.8"),
      urlEntry(`${BASE_URL}/search`, today, "monthly", "0.6"),
    ];

    const categoryPages = categories.map((cat) => {
      const lastmod = new Date(cat.createdAt).toISOString().slice(0, 10);
      return urlEntry(`${BASE_URL}/category/${cat.slug}`, lastmod, "daily", "0.8");
    });

    const entityPageEntries = entityPages.map((ep) => {
      const lastmod = ep.updatedAt
        ? new Date(ep.updatedAt).toISOString().slice(0, 10)
        : ep.publishedAt
        ? new Date(ep.publishedAt).toISOString().slice(0, 10)
        : today;
      return urlEntry(`${BASE_URL}/place/${ep.slug}`, lastmod, "weekly", "0.8");
    });

    const articlePages = articles.map((art) => {
      const lastmod = art.updatedAt
        ? new Date(art.updatedAt).toISOString().slice(0, 10)
        : art.publishedAt
        ? new Date(art.publishedAt).toISOString().slice(0, 10)
        : today;
      return urlEntry(`${BASE_URL}/article/${art.slug}`, lastmod, "weekly", "0.7");
    });

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...staticPages,
      ...pillarPages,
      ...categoryPages,
      ...entityPageEntries,
      ...articlePages,
      "</urlset>",
    ].join("\n");

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (err) {
    res.status(500).send("Failed to generate sitemap");
  }
});

export default router;
