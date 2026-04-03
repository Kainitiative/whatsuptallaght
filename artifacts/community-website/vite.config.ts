import { defineConfig, type Plugin, type ViteDevServer, type PreviewServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { readFile } from "fs/promises";
import type { IncomingMessage, ServerResponse } from "http";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

function escapeAttr(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

interface PostOgData {
  title: string;
  excerpt: string | null;
  headerImageUrl: string | null;
  slug: string;
}

async function fetchPostOgData(slug: string): Promise<PostOgData | null> {
  const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8080";
  try {
    const res = await fetch(`${apiUrl}/api/posts/slug/${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    return (await res.json()) as PostOgData;
  } catch {
    return null;
  }
}

function buildOgTags(post: PostOgData, origin: string): string {
  const title = escapeAttr(post.title || "Tallaght Community");
  const description = escapeAttr(
    post.excerpt || "Local news and stories from Tallaght, Dublin."
  );
  const articleUrl = escapeAttr(`${origin}/article/${post.slug}`);

  let ogImage = "";
  if (post.headerImageUrl) {
    if (post.headerImageUrl.startsWith("http")) {
      ogImage = escapeAttr(post.headerImageUrl);
    } else {
      ogImage = escapeAttr(`${origin}${post.headerImageUrl}`);
    }
  }

  const tags = [
    `<title>${title} — Tallaght Community</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:site_name" content="Tallaght Community" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${articleUrl}" />`,
    ogImage ? `<meta property="og:image" content="${ogImage}" />` : "",
    ogImage ? `<meta property="og:image:width" content="1200" />` : "",
    ogImage ? `<meta property="og:image:height" content="630" />` : "",
    `<meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    ogImage ? `<meta name="twitter:image" content="${ogImage}" />` : "",
  ]
    .filter(Boolean)
    .join("\n    ");

  return tags;
}

function getOrigin(req: IncomingMessage): string {
  const host =
    (req.headers["x-forwarded-host"] as string) ??
    req.headers.host ??
    "tallaghtcommunity.ie";
  const proto =
    (req.headers["x-forwarded-proto"] as string)?.split(",")[0]?.trim() ??
    "https";
  return `${proto}://${host}`;
}

function stripDefaultMetaTags(html: string): string {
  return html
    .replace(/<title>[^<]*<\/title>/gi, "")
    .replace(/<meta\s+name="description"[^>]*>/gi, "")
    .replace(/<meta\s+property="og:[^"]*"[^>]*>/gi, "")
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>/gi, "");
}

function createOgMiddleware(
  getHtml: (url: string, raw: string) => Promise<string>
) {
  return async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
  ) => {
    const url = req.url ?? "";
    const articleMatch = url.match(/\/article\/([^/?#]+)/);
    if (!articleMatch) return next();

    const slug = articleMatch[1];
    const post = await fetchPostOgData(slug);
    if (!post) return next();

    try {
      const origin = getOrigin(req);
      const ogTags = buildOgTags(post, origin);
      const rawHtml = await readFile(
        path.resolve(import.meta.dirname, "index.html"),
        "utf-8"
      );
      const transformed = await getHtml(url, rawHtml);
      const stripped = stripDefaultMetaTags(transformed);
      const finalHtml = stripped.replace(
        "</head>",
        `    ${ogTags}\n  </head>`
      );
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.statusCode = 200;
      res.end(finalHtml);
    } catch {
      next();
    }
  };
}

function ogMetaPlugin(): Plugin {
  return {
    name: "og-meta-injector",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        createOgMiddleware((url, raw) => server.transformIndexHtml(url, raw))
      );
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(
        createOgMiddleware(async (_url, raw) => raw)
      );
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    ogMetaPlugin(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
