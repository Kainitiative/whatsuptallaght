import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";

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
  app.use(express.static(communityDir, { index: "index.html" }));
  // SPA fallback for client-side routing (exclude /api/* to avoid masking 404s)
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(communityDir, "index.html"));
  });
}

export default app;
