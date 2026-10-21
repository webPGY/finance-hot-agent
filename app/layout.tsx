import type { Metadata } from "next";
import React from "react";

import { AppSidebar } from "../src/components/AppSidebar";

export const metadata: Metadata = {
  title: "Finance Hot Agent",
  description: "Finance hot news agent dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          background: "#f3f4f6",
          color: "#111827",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            maxHeight: "100vh",
            width: "100%",
          }}
        >
          <AppSidebar />
          <div style={{ flex: 1,overflow: "auto", minWidth: 0, padding: "2rem" }}>{children}</div>
        </div>
      </body>
    </html>
  );
}
