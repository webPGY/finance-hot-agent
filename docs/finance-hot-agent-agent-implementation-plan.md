# 财经热点排行智能体实现方案（项目内文档）

> 目标：基于当前项目基础设施，按照 LangGraph + Next.js + Prisma 的架构，逐步实现「多源财经热榜抓取、去重归并、Top10 排名、每日摘要、数据库落库、定时调度和页面展示」的完整智能体闭环。

---

## 0. 测试先行与验收要求

在本项目中，所有核心逻辑改动都必须遵循“测试先行”原则：

1. 先编写最小可验证单元测试
2. 确认测试在当前代码状态下失败
3. 实现最小修复
4. 再重新执行测试，确保通过
5. 最终输出结果时附上测试命令和通过证据

建议的测试入口：

```bash
npm test
```

推荐测试范围：

- 规则去重逻辑
- Top10 排序逻辑
- 数据源统一转换逻辑
- `saveHotNewsBatch` 的幂等写入
- `routeAfterRank` 等图分支条件

建议新增目录：

```text
src/**/*.test.ts
```

测试运行使用 Node.js 原生测试框架（`node:test` + `assert`），无需额外依赖，便于轻量运行。

---

## 1. 项目现状评估

当前仓库已经具备以下基础能力：

- Next.js 应用已初始化，入口在 `app/page.tsx`
- Prisma 数据库模型已定义，支持 `HotNews`、`DailySummary`、`CronJob`、`FetchRun`、`AgentRun`
- `@prisma/client` 单例已封装，见 `src/lib/prisma.ts`
- 基础仓储层已提供 `upsertHotNews`、`saveHotNewsBatch`、`getTopNews` 等能力
- LangGraph checkpointer 已具备 Postgres 接入能力
- 技术设计原稿已在项目根目录 `finance-hot-agent-technical-design.md` 中说明架构与思路

结论：项目已进入“实施 Agent 核心链路”的阶段，而不是从零搭建工程。

---

## 2. 总体实现思路

按照设计文档，最终系统将分为 5 个层次：

1. 采集层：抓取多来源热点数据
2. 智能体层：LangGraph 编排抓取、去重、排序、摘要、保存
3. 持久化层：Prisma 写入热榜并记录摘要和执行日志
4. 调度层：`node-cron` + DB 驱动多时间点任务
5. 展示层：Next.js 页面展示 Top10、历史数据和管理后台

核心闭环：

`定时触发 -> 抓取多源 -> 去重合并 -> 排名 Top10 -> 摘要生成 -> 存库 -> 前端展示`

---

## 3. 实施目标与里程碑

### 里程碑 1：核心采集与排序链路可运行

目标：

- 能够从至少一个数据源获取热点列表
- 能够Parse成统一结构
- 能够排序并输出 Top10
- 能够在本地终端打印结果

交付物：

- `src/datasources/aggregator.ts`
- `src/agent/nodes/scrape.ts`
- `src/agent/nodes/dedup.ts`
- `src/agent/nodes/rank.ts`

验收标准：

- 调用一次采集入口，返回至少 10 条有效热点
- 无异常抛错
- 结果按热度/时间排序

### 里程碑 2：LangGraph 智能体流程封装完成

目标：

- 将抓取、去重、排序、总结、保存编排成一条 StateGraph
- 允许失败重试和条件分支
- Checkpointer 持久化状态

交付物：

- `src/agent/state.ts`
- `src/agent/graph.ts`
- `src/agent/nodes/summarize.ts`
- `src/agent/nodes/save.ts`

验收标准：

- `graph.invoke({})` 可正常执行
- 输出中包含 `top10`、`summary`、`errors`
- 数据库写入成功

### 里程碑 3：数据库落库与历史展示可用

目标：

- 热点数据能按日期写入 `HotNews`
- 每日摘要能写入 `DailySummary`
- 首页可展示 Top10
- 历史页可按日期查看数据

交付物：

- `app/page.tsx` 更新为真实数据展示
- `app/history/page.tsx`
- `app/api/cron/trigger/route.ts`

验收标准：

- 首页展示 Top10 列表
- 历史查询按 `date` 条件工作
- 数据去重写入正确

### 里程碑 4：定时调度与后台管理

目标：

- 支持多时间点 cron 配置
- 支持动态增加/删除/启停任务
- 通过 `node-cron` 或 API 触发

交付物：

- `src/scheduler/cron.ts`
- `src/scheduler/runner.ts`
- `app/admin/cron/page.tsx`
- `app/api/cron/jobs/route.ts`

验收标准：

- cron job 可增删改
- 任务执行后调用 graph
- 任务状态可观测

---

## 4. 技术实现方案

### 4.1 统一数据结构

建议统一定义如下数据类型：

```ts
export interface RawHotItem {
  source: string;
  title: string;
  url: string;
  hotScore?: number;
  publishedAt?: Date;
}

export interface HotItem {
  source: string;
  title: string;
  url: string;
  hotScore: number;
  rank: number;
  publishedAt: Date;
}
```

约束：

- 所有采集器输出都转换成统一结构
- 统一时间字段 `publishedAt`
- 不允许直接写数据库的原始不规范数据

### 4.2 Agent State 设计

建议在 `src/agent/state.ts` 中增加如下结构：

```ts
import { Annotation } from "@langchain/langgraph";

export const AgentState = Annotation.Root({
  rawItems: Annotation<RawHotItem[]>({
    reducer: (a, b) => b ?? a,
    default: () => [],
  }),
  merged: Annotation<HotItem[]>({
    reducer: (a, b) => b ?? a,
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

重点：

- `rawItems` 保存多源原始抓取数据
- `merged` 保存去重后归并结果
- `top10` 保存最终排序结果
- `errors` 用于记录单源失败和重试日志

### 4.3 采集层设计

#### 4.3.1 数据源优先级

优先顺序建议如下：

1. 聚合 API
2. 公开 HTTP 接口
3. HTML 页面抓取（Cheerio）
4. 反爬站点（Decodo / Playwright）

#### 4.3.2 实现建议

建议新增 `src/datasources/aggregator.ts`，内部提供：

```ts
export async function fetchHottestNews(): Promise<RawHotItem[]> {
  // 1. 取聚合接口
  // 2. 统一转换
  // 3. 返回规范数据
}
```

若后续扩展多源：

- `eastmoney.ts`
- `xueqiu.ts`
- `sina.ts`
- `cls.ts`

统一由 `aggregator.ts` 聚合调度，最终输出 `RawHotItem[]`。

### 4.4 去重设计

去重策略建议分两层：

1. 规则去重：
   - 同 `source + url` 直接过滤
   - 同标题 + 相似 URL 做近似合并
2. LLM 去重：
   - 针对标题相近但不同表述的新闻归并
   - 通过大模型判断是否为同一事件

优先级建议：

- 先规则去重，再 LLM 归并，避免模型成本过高

### 4.5 排名逻辑

建议使用“热度权重 + 时间衰减”做排序：

```ts
const score = hotScore * 0.7 + recencyBoost * 0.3;
```

核心思想：

- 热度是主因
- 新鲜度是次因
- 排序后截取 `top10`

### 4.6 摘要设计

每日摘要建议在 `summarize_node` 中生成：

```ts
summary = "今日热点主要集中在：...\n\n受市场关注的板块：...";
```

摘要内容包括：

- 今日的核心事件
- 板块关注趋势
- 市场情绪判断（可选）

### 4.7保存逻辑

`save_node` 应由 `saveHotNewsBatch` + `saveDailySummary` 组成：

- 每个新闻按 `(source, url)` 去重 upsert
- 按日期记录 `HotNews`
- 生成单日 `DailySummary`
- 审计运行状态写入 `AgentRun`

---

## 5. LangGraph 执行流设计

推荐图结构如下：

```ts
const graph = new StateGraph(AgentState)
  .addNode("scrape", scrapeNode)
  .addNode("dedup", dedupNode)
  .addNode("rank", rankNode)
  .addNode("summarize", summarizeNode)
  .addNode("save", saveNode)
  .addConditionalEdges("rank", routeAfterRank)
  .addEdge("scrape", "dedup")
  .addEdge("dedup", "rank")
  .addEdge("summarize", "save")
  .addEdge("save", END);
```

### 条件边设计

```ts
function routeAfterRank(state: typeof AgentState.State) {
  return state.merged.length > 0 ? "summarize" : "fallback";
}
```

如果 `merged` 为空：

- 返回上一个有效榜单或记录空数据状态
- 标记 `errors` 并结束

---

## 6. 调度器设计

### 6.1 node-cron 方案（推荐）

适用场景：

- 需要自托管长驻进程
- 允许动态增删 cron job
- 需要数据库驱动多时间点调度

### 6.2 任务执行入口

建议在 `src/scheduler/runner.ts` 中添加：

```ts
export async function runHotNewsJob() {
  const graph = buildAgentGraph();
  await graph.invoke({});
}
```

### 6.3 CronJob 表结构

当前 `prisma/schema.prisma` 已包含：

```prisma
model CronJob {
  id        String   @id @default(cuid())
  name      String   @default("default")
  schedule  String
  timezone  String   @default("Asia/Shanghai")
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

因此后续管理后台不会再重构数据库，直接按此模型实现增删改查即可。

---

## 7. Next.js 页面方案

### 7.1 首页

首页展示当前最新一期 Top10：

- 标题
- 来源
- 热度
- 发布时间
- 跳转链接

实现方式：

- Server Component 读取数据库
- `revalidate` 设为 300s
- 更新之后调用 `revalidateTag("hot-list")`

### 7.2 历史页

路由：

- `/history?date=2026-09-11`

功能：

- 按日期筛选
- 展示历史抓取结果
- 支持排序和过滤

### 7.3 管理后台

路由：

- `/admin/cron`

功能：

- 新增 cron job
- 开关 cron
- 删除任务
- 手工触发任务

---

## 8. 实施步骤（按优先级）

### Step 1：建立采集入口和统一结构

任务：

- 新建 `src/datasources` 目录
- 实现 `fetchHottestNews()`
- 输出统一的 `RawHotItem[]`

### Step 2：实现节点逻辑

任务：

- `scrape_node`：抓取 + 错误收集
- `dedup_node`：去重归并
- `rank_node`：排序 Top10
- `summarize_node`：生成摘要
- `save_node`：落库保存

### Step 3：组装 LangGraph

任务：

- 创建 `src/agent/graph.ts`
- 配置 `StateGraph`
- 使用 checkpointer
- 添加条件分支和错误处理

### Step 4：完善仓储与数据库操作

任务：

- 实现 `saveHotNewsBatch`
- 记录每日 summary
- 启用 `AgentRun` 审计日志

### Step 5：接入调度器

任务：

- 创建 cron task
- 动态从 DB 读取 jobs
- 手工触发执行入口

### Step 6：更新页面展示

任务：

- 首页展示真实数据
- 历史页支持筛选
- 管理页支持配置

### Step 7：验收与优化

任务：

- 处理异常情况
- 验证 `node-cron` 执行
- 测试数据写入合规性
- 加入 fallback 和 LangSmith tracing

---

## 9. 关键实施注意事项

1. 先跑通一个数据源，再扩展多个数据源
2. 先保证幂等，再考虑性能优化
3. 先实现业务闭环，再增加 LLM 复杂逻辑
4. 先写 DB 结构，再接页面和调度器
5. 先关注抓取成功率，再优化摘要质量

---

## 10. 建议的实现目录结构

```text
finance-hot-agent/
├── app/
│   ├── api/
│   │   ├── cron/
│   │   │   ├── jobs/route.ts
│   │   │   └── trigger/route.ts
│   ├── admin/
│   │   └── cron/page.tsx
│   ├── history/page.tsx
│   └── page.tsx
├── docs/
│   └── finance-hot-agent-agent-implementation-plan.md
├── prisma/
│   └── schema.prisma
├── src/
│   ├── agent/
│   │   ├── graph.ts
│   │   ├── state.ts
│   │   ├── checkpointer.ts
│   │   ├── types.ts
│   │   └── nodes/
│   │       ├── scrape.ts
│   │       ├── dedup.ts
│   │       ├── rank.ts
│   │       ├── summarize.ts
│   │       └── save.ts
│   ├── datasources/
│   │   ├── aggregator.ts
│   │   ├── eastmoney.ts
│   │   └── xueqiu.ts
│   ├── scheduler/
│   │   ├── cron.ts
│   │   └── runner.ts
│   └── lib/
│       ├── prisma.ts
│       ├── hotNewsRepository.ts
│       └── cleanup.ts
├── finance-hot-agent-technical-design.md
├── package.json
├── README.md
└── tsconfig.json
```

---

## 11. 最终落地方式

推荐采用“分阶段迭代”方式推进：

- 第一阶段：抓取 + Top10 排序
- 第二阶段：LangGraph 编排 + Checkpoint
- 第三阶段：数据库落库 + 页面展示
- 第四阶段：cron 调度 + 管理后台
- 第五阶段：LLM 去重/摘要 + tracing + fallback

这会降低开发风险，且每一步都有明确验收标准。

---

## 12. 最后结论

当前项目的技术基座已经较完整，最大短板已经不是“搭环境”，而是“把踪迹清晰落成真正的智能体执行链”。

接下来应该按照上述步骤，先做“抓取 + 去重 + 排序”这个最小可运行闭环，再不断扩展为完整的自动化热点排行智能体系统。
