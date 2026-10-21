import { getConfiguredHotNewsSource } from "../../../src/lib/hotNewsConfig";
import prisma from "../../../src/lib/prisma";
import { createCronJob, deleteCronJob, setHotNewsSource, toggleCronJob } from "./actions";
import { ensureSchedulerStarted } from "../../../src/scheduler/bootstrap";
import TriggerCronButton from "./trigger-button";

export default async function CronAdminPage() {
  await ensureSchedulerStarted();
  const jobs = await prisma.cronJob.findMany({
    orderBy: { createdAt: "asc" },
  });
  const currentSource = getConfiguredHotNewsSource();

  return (
    <main style={{ maxWidth: "960px", margin: "0 auto" }}>
      <h1>调度管理</h1>

      <section style={{ display: "grid", gap: "0.75rem", marginBottom: "2rem" }}>
        <div>
          <strong>当前抓取源</strong>
          <div style={{ marginTop: "0.5rem" }}>{currentSource}</div>
        </div>

        <form action={async (formData: FormData) => { "use server"; await setHotNewsSource(String(formData.get("source") ?? "cnbc")); }} style={{ display: "grid", gap: "0.75rem" }}>
          <div>
            <label htmlFor="source">数据源</label>
            <select id="source" name="source" defaultValue={currentSource} style={{ width: "100%", padding: "0.5rem" }}>
              <option value="cnbc">cnbc</option>
              <option value="yahoo">yahoo</option>
              <option value="all">all</option>
            </select>
          </div>
          <button type="submit">切换源</button>
        </form>
      </section>

      <form action={createCronJob} style={{ display: "grid", gap: "0.75rem", marginBottom: "2rem" }}>
        <div>
          <label>名称</label>
          <input name="name" defaultValue="default" style={{ width: "100%", padding: "0.5rem" }} />
        </div>
        <div>
          <label>cron 表达式</label>
          <input name="schedule" defaultValue="0 8 * * *" style={{ width: "100%", padding: "0.5rem" }} />
        </div>
        <div>
          <label>时区</label>
          <input name="timezone" defaultValue="Asia/Shanghai" style={{ width: "100%", padding: "0.5rem" }} />
        </div>
        <div>
          <label>
            <input type="checkbox" name="enabled" defaultChecked />
            启用
          </label>
        </div>
        <button type="submit">新增任务</button>
      </form>

      <TriggerCronButton />

      {jobs.length === 0 ? (
        <p>暂无配置任务。</p>
      ) : (
        <ul>
          {jobs.map((job: { id: string; name: string; schedule: string; timezone: string; enabled: boolean }) => (
            <li key={job.id} style={{ marginBottom: "1rem" }}>
              <div><strong>{job.name}</strong></div>
              <div>schedule: {job.schedule}</div>
              <div>timezone: {job.timezone}</div>
              <div>enabled: {job.enabled ? "开启" : "关闭"}</div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <form action={async () => { "use server"; await toggleCronJob(job.id, !job.enabled); }}>
                  <button type="submit">{job.enabled ? "关闭" : "开启"}</button>
                </form>
                <form action={async () => { "use server"; await deleteCronJob(job.id); }}>
                  <button type="submit">删除</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
