import cron from "node-cron";

import prisma from "../lib/prisma";
import { runHotNewsJob } from "./runner";

const tasks = new Map<string, cron.ScheduledTask>();

export function syncCronTasks(
  currentTasks: Map<string, cron.ScheduledTask>,
  jobs: Array<{ id: string; enabled: boolean; schedule: string; timezone?: string | null }>,
) {
  const desiredIds = new Set<string>();

  for (const job of jobs) {
    desiredIds.add(job.id);

    if (!job.enabled) {
      const existing = currentTasks.get(job.id);
      if (existing) {
        existing.stop();
        currentTasks.delete(job.id);
      }
      continue;
    }

    if (currentTasks.has(job.id)) continue;

    const task = cron.schedule(job.schedule, async () => {
      await runHotNewsJob();
    }, {
      timezone: job.timezone || "Asia/Shanghai",
    });

    currentTasks.set(job.id, task);
    task.start();
  }

  for (const [id, task] of Array.from(currentTasks.entries())) {
    if (!desiredIds.has(id)) {
      task.stop();
      currentTasks.delete(id);
    }
  }

  return currentTasks;
}

export async function loadAndStartCronJobs() {
  const jobs = await prisma.cronJob.findMany({
    where: { enabled: true },
  });

  return syncCronTasks(tasks, jobs);
}

export async function upsertCronJob(input: {
  id?: string;
  name?: string;
  schedule: string;
  timezone?: string;
  enabled?: boolean;
}) {
  if (input.id) {
    const job = await prisma.cronJob.update({
      where: { id: input.id },
      data: {
        name: input.name ?? undefined,
        schedule: input.schedule,
        timezone: input.timezone ?? "Asia/Shanghai",
        enabled: input.enabled ?? true,
      },
    });

    await loadAndStartCronJobs();
    return job;
  }

  const job = await prisma.cronJob.create({
    data: {
      name: input.name ?? "default",
      schedule: input.schedule,
      timezone: input.timezone ?? "Asia/Shanghai",
      enabled: input.enabled ?? true,
    },
  });

  await loadAndStartCronJobs();
  return job;
}

export async function deleteCronJob(id: string) {
  const task = tasks.get(id);
  if (task) {
    task.stop();
    tasks.delete(id);
  }

  await prisma.cronJob.delete({ where: { id } });
  await loadAndStartCronJobs();
  return true;
}
