import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { postsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getSettingValue } from "./routes/settings";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
// Capture raw body for webhook signature verification (must come before json parser)
app.use(express.json({
  verify: (_req, _res, buf) => {
    (_req as any).rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// In production the Express server also serves the Vite-built static apps.
// This must come AFTER the API router so that /api/* routes are not swallowed.
if (process.env.NODE_ENV === "production") {
  const staticDir = process.env.STATIC_DIR ?? "/app/static";

  // Admin dashboard — mounted at /admin
  const adminDir = path.join(staticDir, "admin");
  app.use("/admin", express.static(adminDir, { index: "index.html" }));
  // SPA fallback: any /admin/* path that isn't a file returns index.html
  app.get(/^\/admin(\/.*)?$/, (_req, res) => {
    res.sendFile(path.join(adminDir, "index.html"));
  });

  // Community website — served at root, catch-all (must be last)
  const communityDir = path.join(staticDir, "community");

  // ---------------------------------------------------------------------------
  // Article OG meta injection — must come BEFORE static file middleware so that
  // crawlers (Facebook, Twitter, WhatsApp) see per-article title/image tags.
  // React replaces these at runtime for normal users, so this is transparent.
  // ---------------------------------------------------------------------------
  let communityIndexHtml: string | null = null;

  function escapeAttr(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  app.get(/^\/article\/([^/]+)$/, async (req, res, next) => {
    try {
      const slug = (req.params as Record<string, string>)[0];
      if (!slug) return next();

      const [post] = await db
        .select({
          title: postsTable.title,
          excerpt: postsTable.excerpt,
          headerImageUrl: postsTable.headerImageUrl,
          bodyImages: postsTable.bodyImages,
          status: postsTable.status,
        })
        .from(postsTable)
        .where(eq(postsTable.slug, slug))
        .limit(1);

      if (!post || post.status !== "published") return next();

      // Cache the base index.html in memory (it never changes at runtime)
      if (!communityIndexHtml) {
        communityIndexHtml = fs.readFileSync(path.join(communityDir, "index.html"), "utf8");
      }

      const platformUrl = (await getSettingValue("platform_url")) ?? "https://whatsuptallaght.ie";
      const articleUrl = `${platformUrl}/article/${slug}`;

      // Prefer submitted WhatsApp photo as the social share image — it's more compelling
      // and authentic than a generated header. Fall back to the AI-generated header.
      const bodyImgs: string[] = Array.isArray(post.bodyImages) ? (post.bodyImages as string[]) : [];
      const ogImagePath = bodyImgs[0] || post.headerImageUrl;
      const ogImage = ogImagePath
        ? ogImagePath.startsWith("http")
          ? ogImagePath
          : `${platformUrl}${ogImagePath}`
        : `${platformUrl}/images/tallaght-news.png`;

      const title = escapeAttr(post.title ?? "Tallaght Community");
      const desc = escapeAttr(post.excerpt ?? "Local news from Tallaght, Dublin.");

      // Replace the generic site-level OG tags with article-specific values
      let html = communityIndexHtml;
      html = html.replace(/(<meta property="og:title" content=")[^"]*(")/g, `$1${title}$2`);
      html = html.replace(/(<meta property="og:description" content=")[^"]*(")/g, `$1${desc}$2`);
      html = html.replace(/(<meta property="og:image" content=")[^"]*(")/g, `$1${ogImage}$2`);
      html = html.replace(/(<meta name="twitter:title" content=")[^"]*(")/g, `$1${title}$2`);
      html = html.replace(/(<meta name="twitter:description" content=")[^"]*(")/g, `$1${desc}$2`);
      html = html.replace(/(<meta name="twitter:image" content=")[^"]*(")/g, `$1${ogImage}$2`);
      // Inject og:url just before </head>
      html = html.replace("</head>", `  <meta property="og:url" content="${articleUrl}" />\n</head>`);

      res.type("html").send(html);
    } catch (err) {
      logger.warn({ err }, "OG meta injection failed, falling back to static file");
      next();
    }
  });

  app.use(express.static(communityDir, { index: "index.html" }));
  // SPA fallback for client-side routing (exclude /api/* to avoid masking 404s)
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(communityDir, "index.html"));
  });
}

export default app;
