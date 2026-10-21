import { loadAndStartCronJobs } from "./cron";

const schedulerBootstrapState = globalThis as typeof globalThis & {
  __financeHotAgentSchedulerStarted?: boolean;
};

export async function ensureSchedulerStarted() {
  if (schedulerBootstrapState.__financeHotAgentSchedulerStarted) {
    return;
  }

  schedulerBootstrapState.__financeHotAgentSchedulerStarted = true;
  try {
    await loadAndStartCronJobs();
  } catch (error) {
    schedulerBootstrapState.__financeHotAgentSchedulerStarted = false;
    console.error("Failed to start cron scheduler:", error);
  }
}
