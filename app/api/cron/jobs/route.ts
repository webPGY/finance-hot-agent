import { NextResponse } from "next/server";

import prisma from "../../../../src/lib/prisma";
import { loadAndStartCronJobs } from "../../../../src/scheduler/cron";

export async function GET() {
  const jobs = await prisma.cronJob.findMany({
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  const body = await request.json();

  const job = await prisma.cronJob.create({
    data: {
      name: body.name ?? "default",
      schedule: body.schedule ?? "0 8 * * *",
      timezone: body.timezone ?? "Asia/Shanghai",
      enabled: body.enabled ?? true,
    },
  });

  await loadAndStartCronJobs();

  return NextResponse.json({ job });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing cron job id" }, { status: 400 });
  }

  const job = await prisma.cronJob.delete({
    where: { id },
  });

  await loadAndStartCronJobs();

  return NextResponse.json({ job });
}
