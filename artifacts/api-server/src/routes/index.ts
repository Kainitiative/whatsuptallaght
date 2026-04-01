import { Router, type IRouter } from "express";
import healthRouter from "./health";
import categoriesRouter from "./categories";
import postsRouter from "./posts";
import submissionsRouter from "./submissions";
import contributorsRouter from "./contributors";
import adminRouter from "./admin";
import rssRouter from "./rss";
import statsRouter from "./stats";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(categoriesRouter);
router.use(postsRouter);
router.use(submissionsRouter);
router.use(contributorsRouter);
router.use(adminRouter);
router.use(rssRouter);
router.use(statsRouter);
router.use(settingsRouter);

export default router;
