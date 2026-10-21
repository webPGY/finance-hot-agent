'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
  { href: "/", label: "首页" },
  { href: "/history", label: "历史热点" },
  { href: "/admin", label: "后台管理" },
  { href: "/admin/cron", label: "调度管理" },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: "220px",
        flex: "0 0 220px",
        minHeight: "100vh",
        padding: "1.5rem 1rem",
        background: "#f8fafc",
        borderRight: "1px solid #e5e7eb",
      }}
    >
      <div style={{ fontSize: "1.08rem", fontWeight: 800, color: "#111827", marginBottom: "1.5rem" }}>
        Finance Hot Agent
      </div>

      <nav style={{ display: "grid", gap: "0.5rem" }}>
        {menuItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === "/admin" && pathname === "/admin") ||
            (item.href === "/admin" && pathname.startsWith("/admin/") && pathname !== "/admin/cron") ||
            (item.href === "/admin/cron" && pathname.startsWith("/admin/cron"));

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "block",
                padding: "0.8rem 0.9rem",
                borderRadius: "12px",
                textDecoration: "none",
                fontWeight: 600,
                transition: "all 0.2s ease",
                background: isActive ? "#dbeafe" : "transparent",
                color: isActive ? "#1d4ed8" : "#374151",
                border: isActive ? "1px solid #bfdbfe" : "1px solid transparent",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
