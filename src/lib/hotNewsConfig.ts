import fs from "node:fs";
import path from "node:path";

const ENV_FILE_PATH = path.join(process.cwd(), ".env");
const VALID_SOURCES = ["all", "cnbc", "yahoo"] as const;

function normalizeSource(value: string | undefined): string {
  const raw = String(value ?? "cnbc").trim().toLowerCase();
  const normalized = raw === "yahoo-finance" ? "yahoo" : raw;
  return VALID_SOURCES.includes(normalized as (typeof VALID_SOURCES)[number]) ? normalized : "cnbc";
}

function readEnvFile(): Record<string, string> {
  if (!fs.existsSync(ENV_FILE_PATH)) {
    return {};
  }

  const result: Record<string, string> = {};
  const lines = fs.readFileSync(ENV_FILE_PATH, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    result[key] = value.replace(/^['"]|['"]$/g, "");
  }

  return result;
}

function writeEnvFile(values: Record<string, string>) {
  const entries = Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  fs.writeFileSync(ENV_FILE_PATH, `${entries}\n`, "utf8");
}

export function getConfiguredHotNewsSource(): string {
  const envSource = process.env.HOT_NEWS_SOURCE ?? process.env.HOT_NEWS_SOURCES;
  if (envSource && envSource.trim()) {
    const normalized = normalizeSource(envSource);
    process.env.HOT_NEWS_SOURCE = normalized;
    process.env.HOT_NEWS_SOURCES = normalized;
    return normalized;
  }

  const fileValues = readEnvFile();
  const source = fileValues.HOT_NEWS_SOURCE ?? fileValues.HOT_NEWS_SOURCES ?? "cnbc";
  const normalized = normalizeSource(source);

  process.env.HOT_NEWS_SOURCE = normalized;
  process.env.HOT_NEWS_SOURCES = normalized;
  return normalized;
}

export function setHotNewsSourceConfig(source: string): string {
  const normalized = normalizeSource(source);
  process.env.HOT_NEWS_SOURCE = normalized;
  process.env.HOT_NEWS_SOURCES = normalized;

  const fileValues = readEnvFile();
  fileValues.HOT_NEWS_SOURCE = normalized;
  fileValues.HOT_NEWS_SOURCES = normalized;
  writeEnvFile(fileValues);

  return normalized;
}

export function getHotNewsCountConfig(): number {
  const runtimeValue = Number(process.env.HOT_NEWS_COUNT ?? "10");
  const fileValues = readEnvFile();
  const configuredValue = Number(fileValues.HOT_NEWS_COUNT ?? runtimeValue ?? 10);
  const finalValue = Number.isFinite(configuredValue) && configuredValue > 0 ? Math.floor(configuredValue) : 10;

  process.env.HOT_NEWS_COUNT = String(finalValue);
  return finalValue;
}
