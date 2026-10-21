# 财经热点排行智能体 — 技术方案

> 基于 **LangChain + LangGraph + TypeScript** 实现，支持多时间点自动爬取、Top10 排行、页面展示。

---

## 一、整体架构（分层）

```
┌──────────────── 表现层 (Next.js App Router) ────────────────┐
│  热点列表页 / 管理后台(时间设置)  ←→  API Routes          │
└──────────────────────┬─────────────────────────────────────┘
                       │  HTTP / 轮询 / SSE
┌──────────────────────▼─────────────────────────────────────┐
│  调度层 Scheduler                                          │
│  • node-cron（自托管）/ LangGraph Cron（托管）              │
│  • 多时间点配置（DB 驱动，可增删改）                       │
└──────────────────────┬─────────────────────────────────────┘
                       │  invoke(graph)
┌──────────────────────▼─────────────────────────────────────┐
│  智能体层 LangGraph StateGraph (TypeScript)                │
│  scrape → dedup → rank&summarize → validate → save        │
└──────────┬───────────────────────────────┬─────────────────┘
           │                               │
┌──────────▼─────────┐         ┌──────────▼──────────────────┐
│ 采集层 DataSource   │         │ 持久化  PostgreSQL / Redis  │
│ 东方财富/雪球/财联社 │         │ hot_news 表 + checkpoint    │
│ + Cheerio / Decodo  │         └─────────────────────────────┘
└─────────────────────┘
```

**核心思路**：调度器按配置时间点触发 → 调用 LangGraph 图 → 图内节点分别负责「抓取 / 去重 / 排序汇总 / 校验」 → 结果落库 → 前端读取展示。LangGraph 的价值在于把「多源采集 + LLM 去重/摘要 + 排名」建模成**有状态、可重试、可分支**的图。

---

## 二、技术选型

| 层次       | 选型                                         | 说明                                  |
| ---------- | -------------------------------------------- | ------------------------------------- |
| Agent 框架 | `@langchain/langgraph` ^1.x + `@langchain/core` | TS 类型安全、支持 checkpoint/条件边 |
| LLM        | `@langchain/openai`（gpt-4o-mini 等）       | 去重归并、摘要、情感分析             |
| 采集       | Cheerio / Playwright + 数据源公开 API        | 见第四节                             |
| 调度       | `node-cron`（自托管）或 LangGraph Platform Cron | 多时间点 DB 驱动                   |
| 前端       | Next.js 15 App Router + Server Components    | ISR `revalidate` + `revalidateTag` 按需刷新 |
| 持久化     | PostgreSQL + `langgraph-checkpoint-postgres` | 图状态持久化 + 热点数据              |
| 可观测     | LangSmith Tracing                            | 追踪每次抓取链路                      |

---

## 三、LangGraph 图设计（核心）

### 3.1 State 定义（`src/agent/state.ts`）

```ts
import { Annotation } from "@langchain/langgraph";

export const AgentState = Annotation.Root({
  rawItems: Annotation<RawHotItem[]>({
    reducer: (a, b) => b ?? a,           // 抓取到的原始列表
    default: () => [],
  }),
  merged: Annotation<HotItem[]>({
    reducer: (a, b) => b ?? a,           // 去重归并后
    default: () => [],
  }),
  top10: Annotation<HotItem[]>({
    reducer: (a, b) => b ?? a,
    default: () => [],
  }),
  summary: Annotation<string>({
    reducer: (_l, r) => r,
    default: () => "",
  }),
  errors: Annotation<string[]>({
    reducer: (a, b) => [...a, ...(b ?? [])],
    default: () => [],
  }),
});
```

### 3.2 节点与边

```
START
  └─► scrape_node        (并行抓取多源，失败进 errors，不中断)
        └─► dedup_node    (LLM/规则：同事件归并、去重)
              └─► rank_node       (按热度+时间加权 → 取 Top10)
                    ├─[正常]─► summarize_node  (LLM 生成每日概览)
                    │      └─► save_node        (写库 + revalidateTag)
                    └─[为空]─► fallback_node   (保留昨日 / 标记失败)
                          └─► END
```

**关键点**：

- **并行抓取**：用 `Promise.allSettled` 包一层，单源失败不影响其他源；
- **条件边**：`rank_node` 检查 `merged.length`，为空则走 `fallback_node`；
- **Checkpoint**：挂载 Postgres checkpointer，配合 `interruptBefore` 可在「人工审核后发布」环节暂停/恢复；
- **重试**：抓取节点内置指数退避，LLM 调用用 retry 工具。

---

## 四、数据采集方案（多源 + 合规）

**数据源优先级**（公开、合法、遵守 robots.txt）：

1. **聚合 API（首选，省去爬取）**
   - `hot_news` 聚合接口：支持 `sina_finance`（新浪财经）、`eastmoney`（东方财富）、`xueqiu`（雪球）、`cls`（财联社）等，直接返回 `{title, url, score}`。
   - 深蓝财经 API `/api/v2/dispatches` 免认证、含情感分析。
2. **公开 HTTP 接口**：东方财富 `search-api-web.eastmoney.com`、雪球热榜（需先取 cookie 建 session）。
3. **HTML 兜底**：`CheerioWebBaseLoader`（LangChain）指定 selector 提取正文，比 Puppeteer 轻量、适合 Serverless。
4. **反爬困难站点**：用 Decodo Web Scraper，统一为 LangChain Tool。

> **合规规范**：统一 `RawHotItem = {source, title, url, hotScore, publishedAt}`；控制频率（RateLimiter 1~3s 随机间隔）；遵守 robots.txt。

---

## 五、多时间点调度设计

**需求**：可配置多个爬取时间（如 8:00、12:00、20:00），支持增删改。

### 方案 A：自托管（`node-cron`，推荐自建）

```ts
// 时间配置存 DB：CronJob { id, schedule: "0 8 * * *", enabled, timezone }
class Scheduler {
  private tasks = new Map<string, CronTask>();

  async loadAndStart() {
    const jobs = await db.cronJob.findMany({ where: { enabled: true } });
    jobs.forEach((j) => this.add(j)); // cron.schedule(j.schedule, runner)
  }

  async upsert(job: CronJob) {
    /* 动态增删，无需重启 */
  }

  private runner = () => graph.invoke({}); // 触发 LangGraph
}
```

前端「管理后台」通过 API 增删 `cron_jobs` 表 → 调用 `scheduler.upsert` → **动态生效、无需重启**。

### 方案 B：托管（LangGraph Platform Cron）

用 `@langchain/langgraph-sdk` 的 `client.crons.create` 创建**无状态 cron**（每次新 thread，适合独立采集任务），支持 `schedule` + `timezone` + `retryConfig`。

> **混合建议**：自托管用 `node-cron` 做「业务级多时间点 + 动态管理」；若已用 LangGraph Cloud，则用它做可靠触发，本系统负责生成/更新 cron。

---

## 六、页面展示层（Next.js）

**路由**

- `/` 最新一期 Top10 列表（标题、来源、热度、时间、跳转原文）
- `/history?date=2026-09-11` 历史归档
- `/admin/cron` 调度时间管理（增删改、开关）

**数据获取策略**（兼顾实时与性能）：

```ts
// app/page.tsx (Server Component)
export const revalidate = 300; // ISR 5分钟
async function Home() {
  const items = await db.hotNews.findMany({
    ...top10...,
    orderBy: { hotScore: "desc" },
  });
  return <HotList items={items} />;
}
```

- 抓取 `save_node` 写库后调用 `revalidateTag("hot-list")` **按需即时刷新**，不用等 5 分钟；
- 前端可用 SWR / `useSyncExternalStore` 轮询实现「准实时」；
- 管理页用 Server Actions 提交时间配置 → 触发 `scheduler.upsert`。

**UI**：Ant Design / shadcn/ui 表格 + 热度条形图，移动端竖屏优先。

---

## 七、数据模型（Prisma 示例）

```prisma
model HotNews {
  id          String   @id @default(cuid())
  title       String
  url         String
  source      String   // eastmoney / xueqiu / cls ...
  hotScore    Float
  rank        Int
  publishedAt DateTime
  fetchedAt   DateTime @default(now())
  date        String   // 2026-09-11 分区索引

  @@unique([source, url])
  @@index([date, rank])
}

model CronJob {            // 多时间点配置
  id        String @id @default(cuid())
  schedule  String // "0 8,12,20 * * *"
  timezone  String @default("Asia/Shanghai")
  enabled   Boolean @default(true)
}
```

---

## 八、项目结构

```
finance-hot-agent/
├── src/
│   ├── agent/
│   │   ├── graph.ts          # StateGraph 构建
│   │   ├── state.ts
│   │   └── nodes/           # scrape / dedup / rank / summarize / save
│   ├── datasources/         # eastmoney / xueqiu / cls / aggregator
│   ├── scheduler/           # node-cron 动态管理
│   └── lib/{db, rate-limiter}.ts
├── app/                    # Next.js
│   ├── page.tsx            # 热点列表
│   ├── history/page.tsx
│   ├── admin/cron/page.tsx
│   └── api/
│       ├── cron/trigger/route.ts   # 被调度器/外部调用
│       └── cron/jobs/route.ts      # 管理 CRUD
├── langgraph.json          # 托管部署配置
├── prisma/schema.prisma
└── package.json
```

---

## 九、部署与可靠性

- **自托管**：单 Node 服务跑 `node-cron` + Next.js（Docker Compose：web + postgres），有长驻进程，cron 可靠。
- **Serverless（Vercel）**：cron 必须**外部触发**，`vercel.json` 配 `crons` + `CRON_SECRET` 鉴权，路由内部 `start()` 工作流。
- **可靠性**：at-least-once 抓取、死信进 `errors`、单源失败不阻断、LLM 重试、结果空时 fallback。
- **可观测**：LangSmith trace 每次图执行。

---

## 十、落地步骤（建议顺序）

1. **PoC（1~2 天）**：接聚合 API + Cheerio 单源，跑通「抓取 → Top10 → 打印」；
2. **图化**：把流程拆成 LangGraph 节点 + checkpoint，验证重试/分支；
3. **持久化 + 前端**：接 Postgres + Next.js 列表页（ISR + revalidateTag）；
4. **调度**：接入 `node-cron`，DB 驱动多时间点，做管理后台；
5. **增强**：LLM 去重归并/摘要/情感、多源扩展、fallback、LangSmith 监控。

---

## 附录：可扩展方向

- **多 Agent 协作**：采集 Agent / 分析 Agent / 审核 Agent 拆分，LangGraph 跨图调用。
- **个性化**：基于用户关注板块（新能源/半导体等）做加权排序。
- **告警**：突发重大事件（热度激增）通过 Webhook 推送企业微信/飞书。
- **归档分析**：热点趋势、情绪指数、板块热度热力图。
- **多端**：增加邮件订阅、RSS、移动端 App。
