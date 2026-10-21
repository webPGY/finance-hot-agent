# Finance Hot Agent — 数据库自动化模块

零人工介入的数据库方案：托管实例 + Schema as Code + Seed + Upsert + 自动清理 + Checkpoint。

## 目录结构

```
finance-hot-agent/
├── prisma/
│   ├── schema.prisma          # 数据模型（HotNews/DailySummary/CronJob/...）
│   └── seed.ts                # 种子脚本：默认调度配置，幂等
├── src/
│   ├── lib/
│   │   ├── prisma.ts          # Prisma Client 单例
│   │   ├── hotNewsRepository.ts  # upsert 幂等写入 + 查询 + 每日摘要
│   │   └── cleanup.ts         # 自动清理（node-cron + pg_cron 双版本）
│   └── agent/
│       ├── types.ts           # 共享类型
│       └── checkpointer.ts    # LangGraph PostgresSaver 自动建表
├── scripts/
│   └── setup.ts               # 一键初始化：migrate → seed → checkpoint
├── Dockerfile                 # 容器启动自动 migrate + seed
├── package.json
└── .env.example
```

## 快速开始

### 1. 准备数据库（仅点一次）
在 Supabase / Neon / 云厂商 创建托管 PostgreSQL 实例，复制连接串。

### 2. 配置环境变量
```bash
cp .env.example .env
# 填入 DATABASE_URL、OPENAI_API_KEY
```

### 3. 一键初始化（建表 + seed + checkpoint，全自动）
```bash
npm install
npm run setup
```

### 4. 启动
```bash
npm run dev
```

之后所有环节自动化：
| 环节 | 自动化 |
|---|---|
| 建表/改表 | `prisma migrate deploy`（build/容器启动自动执行） |
| 初始配置 | seed 幂等写入默认 3 个时间点 |
| 写入去重 | `upsertHotNews` 唯一约束幂等 |
| 旧数据清理 | 每天 02:00 自动删 30 天前数据 |
| 断点恢复 | LangGraph Checkpointer 自动建表 |
| 备份 | 托管平台每日自动 |

## 常用命令

```bash
npm run setup          # 首次一键初始化
npm run prisma:studio  # 可视化查看数据（可选）
npm run cleanup        # 手动触发一次清理
npm run build          # 构建（自动 migrate + generate）
```

## 幂等保证
- `setup` / `seed` / `migrate deploy` / `checkpointer.setup()` 全部幂等，可重复执行
- `upsertHotNews` 基于 `(source, url)` 唯一键，重复抓取不产生脏数据
- 崩溃重启后 LangGraph 从 checkpoint 恢复，不丢不重
# finance-hot-agent
