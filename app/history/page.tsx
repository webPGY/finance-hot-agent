import { HotNewsList } from "../../src/components/HotNewsList";
import { getDateKeyFromOffset, getTodayDateKey } from "../../src/lib/date";
import prisma from "../../src/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams?: Promise<{
    date?: string;
  } | undefined>;
}) {
  const params = (await searchParams) ?? {};
  const today = getTodayDateKey();
  const validSources = ["cnbc", "yahoo"];
  const minDate = getDateKeyFromOffset(-29);
  const allRecentDates = Array.from({ length: 30 }, (_, index) => getDateKeyFromOffset(-(29 - index)));
  const requestedDate = params.date ?? today;
  const selectedDate = allRecentDates.includes(requestedDate) ? requestedDate : today;

  const [items, summaryRow, availableDates] = await Promise.all([
    prisma.hotNews.findMany({
      where: {
        date: selectedDate,
        source: { in: validSources },
      },
      orderBy: [
        {
          hotScore: "desc",
        },
        {
          publishedAt: "desc",
        },
      ],
      take: 20,
    }),
    prisma.dailySummary.findUnique({
      where: {
        date: selectedDate,
      },
    }),
    prisma.hotNews.groupBy({
      by: ["date"],
      where: {
        source: { in: validSources },
        date: {
          gte: minDate,
        },
      },
      orderBy: {
        date: "desc",
      },
    }),
  ]);

  const dbDateSet = new Set(availableDates.map((entry) => entry.date));
  const availableDateOptions = allRecentDates
    .filter((dateString) => dateString === today || dbDateSet.has(dateString))
    .map((dateString) => ({
      date: dateString,
    }));

  const orderedItems = items.map((item, index) => ({
    ...item,
    displayRank: index + 1,
  }));

  const date = selectedDate;

  return (
    <main style={{ maxWidth: "960px", margin: "0 auto" }}>
      <h1>历史热点</h1>

      <form
        method="GET"
        style={{
          marginBottom: "1.5rem",
        }}
      >
        <label
          htmlFor="date"
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: 600,
          }}
        >
          选择日期
        </label>
        <select
          id="date"
          name="date"
          defaultValue={date}
          style={{
            width: "220px",
            padding: "0.5rem",
          }}
        >
          {availableDateOptions.map((entry) => (
            <option key={entry.date} value={entry.date}>
              {entry.date}
            </option>
          ))}
        </select>
        <button
          type="submit"
          style={{
            marginLeft: "0.5rem",
            padding: "0.5rem 0.85rem",
          }}
        >
          查看
        </button>
      </form>

      <p>当前日期：{date}</p>

      {summaryRow ? (
        <section
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            background: "#f5f5f5",
            borderRadius: "8px",
          }}
        >
          <strong>每日摘要</strong>
          <p
            style={{
              margin: "0.75rem 0 0",
            }}
          >
            {summaryRow.summary}
          </p>
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
        emptyMessage="该日期暂无数据。"
      />
    </main>
  );
}
