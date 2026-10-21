"use server";

import { revalidatePath } from "next/cache";

import { getTodayDateKey } from "../../../src/lib/date";
import { setHotNewsSourceConfig } from "../../../src/lib/hotNewsConfig";
import prisma from "../../../src/lib/prisma";

const validSources = ["all", "cnbc", "yahoo"];

export async function createCronJob(formData: FormData) {
  const name = String(formData.get("name") ?? "default");
  const schedule = String(formData.get("schedule") ?? "0 8 * * *");
  const timezone = String(formData.get("timezone") ?? "Asia/Shanghai");
  const enabled = String(formData.get("enabled") ?? "true") === "true";

  await prisma.cronJob.create({
    data: {
      name,
      schedule,
      timezone,
      enabled,
    },
  });

  revalidatePath("/admin/cron");
}

export async function setHotNewsSource(source: string) {
  const normalized = String(source ?? "cnbc").trim().toLowerCase();
  const finalSource = validSources.includes(normalized) ? normalized : "cnbc";

  setHotNewsSourceConfig(finalSource);

  if (finalSource !== "all") {
    const today = getTodayDateKey();
    await prisma.hotNews.deleteMany({
      where: {
        source: finalSource,
        date: today,
      },
    });
  }

  revalidatePath("/admin/cron");
  revalidatePath("/");

  return finalSource;
}

export async function changeHotNewsSource(formData: FormData) {
  "use server";
  const source = String(formData.get("source") ?? "cnbc");
  await setHotNewsSource(source);
}

export async function toggleCronJob(id: string, enabled: boolean) {
  await prisma.cronJob.update({
    where: { id },
    data: { enabled },
  });

  revalidatePath("/admin/cron");
}

export async function deleteCronJob(id: string) {
  await prisma.cronJob.delete({
    where: { id },
  });

  revalidatePath("/admin/cron");
}
