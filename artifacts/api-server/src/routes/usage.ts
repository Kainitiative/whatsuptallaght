import { Router } from "express";
import { db } from "@workspace/db";
import { aiUsageLogTable } from "@workspace/db/schema";
import { sql, desc } from "drizzle-orm";
import { adminAuth } from "../lib/admin-auth";

const router = Router();

router.use(adminAuth);

router.get("/", async (_req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [totalsToday, totalsWeek, totalsMonth, totalsAll] = await Promise.all([
      db.execute(sql`
        SELECT
          COALESCE(SUM(input_tokens),0)::int AS input_tokens,
          COALESCE(SUM(output_tokens),0)::int AS output_tokens,
          COALESCE(SUM(estimated_cost_usd::numeric),0)::float AS cost_usd
        FROM ai_usage_log
        WHERE created_at >= ${todayStart.toISOString()}
      `),
      db.execute(sql`
        SELECT
          COALESCE(SUM(input_tokens),0)::int AS input_tokens,
          COALESCE(SUM(output_tokens),0)::int AS output_tokens,
          COALESCE(SUM(estimated_cost_usd::numeric),0)::float AS cost_usd
        FROM ai_usage_log
        WHERE created_at >= ${weekStart.toISOString()}
      `),
      db.execute(sql`
        SELECT
          COALESCE(SUM(input_tokens),0)::int AS input_tokens,
          COALESCE(SUM(output_tokens),0)::int AS output_tokens,
          COALESCE(SUM(estimated_cost_usd::numeric),0)::float AS cost_usd
        FROM ai_usage_log
        WHERE created_at >= ${monthStart.toISOString()}
      `),
      db.execute(sql`
        SELECT
          COALESCE(SUM(input_tokens),0)::int AS input_tokens,
          COALESCE(SUM(output_tokens),0)::int AS output_tokens,
          COALESCE(SUM(estimated_cost_usd::numeric),0)::float AS cost_usd
        FROM ai_usage_log
      `),
    ]);

    const byModel = await db.execute(sql`
      SELECT
        model,
        COUNT(*)::int AS calls,
        COALESCE(SUM(input_tokens),0)::int AS input_tokens,
        COALESCE(SUM(output_tokens),0)::int AS output_tokens,
        COALESCE(SUM(estimated_cost_usd::numeric),0)::float AS cost_usd
      FROM ai_usage_log
      GROUP BY model
      ORDER BY cost_usd DESC
    `);

    const byStage = await db.execute(sql`
      SELECT
        stage,
        COUNT(*)::int AS calls,
        COALESCE(SUM(input_tokens),0)::int AS input_tokens,
        COALESCE(SUM(output_tokens),0)::int AS output_tokens,
        COALESCE(SUM(estimated_cost_usd::numeric),0)::float AS cost_usd
      FROM ai_usage_log
      GROUP BY stage
      ORDER BY cost_usd DESC
    `);

    const dailySeries = await db.execute(sql`
      SELECT
        DATE(created_at)::text AS day,
        COALESCE(SUM(estimated_cost_usd::numeric),0)::float AS cost_usd,
        COALESCE(SUM(input_tokens),0)::int AS input_tokens,
        COALESCE(SUM(output_tokens),0)::int AS output_tokens,
        COUNT(DISTINCT submission_id)::int AS submissions
      FROM ai_usage_log
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `);

    const recentEntries = await db
      .select()
      .from(aiUsageLogTable)
      .orderBy(desc(aiUsageLogTable.createdAt))
      .limit(50);

    res.json({
      totals: {
        today: totalsToday.rows[0],
        week: totalsWeek.rows[0],
        month: totalsMonth.rows[0],
        allTime: totalsAll.rows[0],
      },
      byModel: byModel.rows,
      byStage: byStage.rows,
      dailySeries: dailySeries.rows,
      recentEntries,
    });
  } catch (err) {
    console.error("Usage route error:", err);
    res.status(500).json({ error: "Failed to load usage data" });
  }
});

export default router;
