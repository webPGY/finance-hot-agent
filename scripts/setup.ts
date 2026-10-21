#!/usr/bin/env ts-node
/**
 * npm run setup —— 首次部署一键初始化数据库
 * 顺序：migration → seed → checkpointer setup
 */
import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";

async function run() {
  console.log("🚀 开始数据库初始化...\n");

  // 1. 生成 Prisma Client
  console.log("📦 [1/4] 生成 Prisma Client...");
  execSync("npx prisma generate", { stdio: "inherit" });

  // 2. 执行 migration（自动建表，无则创建，有则增量）
  console.log("\n📐 [2/4] 应用数据库迁移...");
  execSync("npx prisma migrate deploy", { stdio: "inherit" });

  // 3. 执行 seed（默认调度配置，已存在则跳过）
  console.log("\n🌱 [3/4] 初始化种子数据...");
  execSync("npx prisma db seed", { stdio: "inherit" });

  // 4. 初始化 LangGraph Checkpointer（自动建 checkpoint 表）
  console.log("\n🧠 [4/4] 初始化 LangGraph Checkpointer...");
  const { getCheckpointer } = await import("../src/agent/checkpointer");
  await getCheckpointer();

  // 校验
  const prisma = new PrismaClient();
  const cronCount = await prisma.cronJob.count();
  await prisma.$disconnect();

  console.log("\n✅ 数据库初始化完成！");
  console.log(`   - 表结构：已就绪（HotNews / DailySummary / CronJob / FetchRun / AgentRun）`);
  console.log(`   - 默认调度配置：${cronCount} 条`);
  console.log(`   - Checkpointer：已就绪`);
  console.log("\n下一步：npm run dev");
}

run().catch((err) => {
  console.error("\n❌ 初始化失败:", err);
  process.exit(1);
});
