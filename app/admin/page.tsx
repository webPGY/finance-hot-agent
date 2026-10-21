export default function AdminHomePage() {
  return (
    <main style={{ maxWidth: "760px", margin: "0 auto" }}>
      <h1>后台管理</h1>
      <p style={{ color: "#4b5563", marginBottom: "1.5rem" }}>请选择要进入的管理页面。</p>

      <nav style={{ display: "grid", gap: "0.75rem" }}>
        <a href="/admin/cron" style={{ padding: "0.9rem 1rem", border: "1px solid #dbeafe", borderRadius: "10px", background: "#eff6ff", color: "#1d4ed8", textDecoration: "none" }}>
          调度管理
        </a>
        <a href="/history" style={{ padding: "0.9rem 1rem", border: "1px solid #e5e7eb", borderRadius: "10px", background: "#f9fafb", color: "#111827", textDecoration: "none" }}>
          历史记录
        </a>
        <a href="/" style={{ padding: "0.9rem 1rem", border: "1px solid #e5e7eb", borderRadius: "10px", background: "#fff", color: "#111827", textDecoration: "none" }}>
          返回首页
        </a>
      </nav>
    </main>
  );
}
