"use client";

import { useState } from "react";

export default function TriggerCronButton() {
  const [status, setStatus] = useState<string>("等待手动触发");
  const [loading, setLoading] = useState(false);

  async function handleTrigger() {
    setLoading(true);
    setStatus("正在执行抓取...");

    try {
      const response = await fetch("/api/cron/trigger", {
        method: "POST",
      });

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "触发失败");
      }

      const top10 = payload.result?.top10 ?? [];
      setStatus(
        top10.length > 0
          ? `已成功执行抓取，当前 Top10 数量：${top10.length}`
          : "已成功执行抓取，但本次未返回热点结果。",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "触发失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <button type="button" onClick={handleTrigger} disabled={loading}>
        {loading ? "执行中..." : "立即执行一次抓取"}
      </button>
      <div style={{ marginTop: "0.75rem", color: "#333" }}>{status}</div>
    </div>
  );
}
