import cron from "node-cron";
import prisma from "./prisma";

const RETENTION_DAYS = Number(process.env.RETENTION_DAYS ?? 30);

/**
 * 方案 A：通过 node-cron 在应用内定时清理（默认每天凌晨 2 点）。
 * 使用：在应用启动时调用 `startCleanupScheduler()`
 */
export function startCleanupScheduler() {
  const task = cron.schedule("0 2 * * *", async () => {
    try {
      const deleted = await cleanupOldNews();
      console.log(`🧹 已清理 ${deleted} 条超过 ${RETENTION_DAYS} 天的热点数据`);
    } catch (err) {
      console.error("❌ 清理任务失败:", err);
    }
  });
  console.log("⏰ 清理调度器已启动（每天 02:00）");
  return task;
}

/**
 * 可手动/在 LangGraph 节点中调用的清理函数
 */
export async function cleanupOldNews() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const result = await prisma.hotNews.deleteMany({
    where: { date: { lt: cutoff } },
  });

  // 同时清理过期的每日摘要
  await prisma.dailySummary.deleteMany({
    where: { date: { lt: cutoff } },
  });

  return result.count;
}

/**
 * 方案 B：pg_cron SQL（Supabase / 自建 Postgres 可用）。
 * 在数据库内直接建定时任务，完全不依赖应用进程。
 * 执行一次即可，之后数据库自动每日清理。
 */
export const PG_CRON_SQL = `
-- 需在数据库中启用 pg_cron 扩展（Supabase 默认已启用）
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'cleanup-old-news',
  '0 2 * * *',
  $$DELETE FROM "hot_news" WHERE "date" < CURRENT_DATE - INTERVAL '${30} days'$$
);
`;
