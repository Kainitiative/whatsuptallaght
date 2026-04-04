import { Router, type IRouter } from "express";
import healthRouter from "./health";
import categoriesRouter from "./categories";
import postsRouter from "./posts";
import submissionsRouter from "./submissions";
import contributorsRouter from "./contributors";
import adminRouter from "./admin";
import goldenExamplesRouter from "./golden-examples";
import rssRouter from "./rss";
import statsRouter from "./stats";
import settingsRouter from "./settings";
import webhookRouter from "./webhook";
import usageRouter from "./usage";
import storageRouter from "./storage";
import publicRouter from "./public";
import eventsRouter from "./events";
import socialRouter from "./social";
import { adminAuth } from "../lib/admin-auth";

const router: IRouter = Router();

// Public routes
router.use(healthRouter);
router.use(publicRouter);
router.use(storageRouter);
router.use(categoriesRouter);
router.use(postsRouter);
router.use(submissionsRouter);
router.use(contributorsRouter);
router.use(rssRouter);
router.use(statsRouter);
router.use(webhookRouter);
router.use(adminRouter); // contains POST /admin/auth — must be unprotected
router.use(eventsRouter); // GET /public/events is public; admin CRUD protected below

// Protected admin-only routes — require Bearer token
router.use(adminAuth);
router.use(settingsRouter);
router.use(goldenExamplesRouter);
router.use(socialRouter);
router.use("/admin/usage", usageRouter);

export default router;
