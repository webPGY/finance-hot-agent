type HotNewsListItem = {
  title: string;
  url: string;
  source: string;
  hotScore: number | string;
  displayRank?: number;
};

export function HotNewsList({
  items,
  emptyMessage,
}: {
  items: HotNewsListItem[];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <p>{emptyMessage}</p>;
  }

  return (
    <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {items.map((item) => (
        <li
          key={`${item.source}-${item.url}`}
          style={{
            display: "grid",
            gridTemplateColumns: "48px 1fr",
            gap: "0.75rem",
            alignItems: "start",
            marginBottom: "1rem",
            padding: "1rem 1rem",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              borderRadius: "9999px",
              background: "#e0f2fe",
              color: "#075985",
              fontWeight: 700,
              fontSize: "0.95rem",
            }}
          >
            {item.displayRank ?? 1}
          </span>

          <div>
            <div style={{ marginBottom: "0.35rem" }}>
              <strong style={{ fontSize: "1.05rem", lineHeight: 1.5 }}>{item.title}</strong>
            </div>
            <div style={{ color: "#4b5563", fontSize: "0.92rem", marginBottom: "0.25rem" }}>
              来源：{item.source} / 热度：{item.hotScore}
            </div>
            <div>
              <a href={item.url} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>
                查看原文
              </a>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
