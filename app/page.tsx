import { HotNewsList } from "../src/components/HotNewsList";
import { getConfiguredHotNewsSource, getHotNewsCountConfig } from "../src/lib/hotNewsConfig";
import { getTodayDateKey } from "../src/lib/date";
import prisma from "../src/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getHomeNewsLimit() {
  return getHotNewsCountConfig();
}

function getConfiguredSource() {
  return getConfiguredHotNewsSource();
}

export default async function HomePage() {
  const today = getTodayDateKey();
  const limit = getHomeNewsLimit();
  const configuredSource = getConfiguredSource();

  const activeDate = today;
  const validSources = ["cnbc", "yahoo"];

  const [items, summaryRow] = await Promise.all([
    prisma.hotNews.findMany({
      where: {
        date: activeDate,
        ...(configuredSource !== "all" ? { source: configuredSource } : { source: { in: validSources } }),
      },
      orderBy: [{ hotScore: "desc" }, { publishedAt: "desc" }],
      take: limit,
    }),
    prisma.dailySummary.findUnique({ where: { date: activeDate } }),
  ]);

  const orderedItems = items.map((item, index) => ({
    ...item,
    displayRank: index + 1,
  }));

  return (
    <main style={{ maxWidth: "960px", margin: "0 auto", color: "#111827" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Finance Hot Agent</h1>
      <p style={{ margin: "0 0 1rem", color: "#4b5563" }}>
        当前热点 Top {limit}（数据源：{configuredSource}，显示最近一次抓取日期：{activeDate}）
      </p>

      {summaryRow ? (
        <section
          style={{
            marginBottom: "1.5rem",
            padding: "1rem 1.25rem",
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          <strong style={{ display: "block", marginBottom: "0.5rem" }}>每日摘要</strong>
          <p style={{ margin: 0, lineHeight: 1.6 }}>{summaryRow.summary}</p>
        </section>
      ) : null}

      <HotNewsList
        items={orderedItems.map((item) => ({
          title: item.title,
          url: item.url,
          source: item.source,
          hotScore: item.hotScore,
          displayRank: item.displayRank,
        }))}
        emptyMessage={`当前来源 ${configuredSource} 暂无有效热点数据，等待下一次抓取或切换到已验证源。`}
      />
    </main>
  );
}
