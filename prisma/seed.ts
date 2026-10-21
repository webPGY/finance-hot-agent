import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 默认每天 3 个抓取时间点（可在管理后台增删改）
const DEFAULT_CRON_JOBS = [
  { name: "morning",  schedule: "0 8 * * *" },
  { name: "noon",     schedule: "0 12 * * *" },
  { name: "evening",  schedule: "0 20 * * *" },
];

async function main() {
  console.log("🌱 开始初始化数据库...");

  // 1. 校验数据库连接
  await prisma.$queryRaw`SELECT 1`;
  console.log("✅ 数据库连接正常");

  // 2. 初始化调度配置（已存在则跳过）
  const existing = await prisma.cronJob.count();
  if (existing === 0) {
    await prisma.cronJob.createMany({
      data: DEFAULT_CRON_JOBS.map((j) => ({
        name: j.name,
        schedule: j.schedule,
        timezone: "Asia/Shanghai",
        enabled: true,
      })),
    });
    console.log(`✅ 已插入 ${DEFAULT_CRON_JOBS.length} 条默认调度配置`);
  } else {
    console.log(`ℹ️ 已有 ${existing} 条调度配置，跳过初始化`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Seed 失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
