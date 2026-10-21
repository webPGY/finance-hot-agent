// 共享类型：采集层 → LangGraph → Repository 通用

export interface RawHotItem {
  source: string;
  title: string;
  url: string;
  hotScore?: number;
  publishedAt?: Date;
}

export interface HotItem {
  source: string;
  title: string;
  url: string;
  hotScore: number;
  rank: number;
  publishedAt: Date;
}

export interface AgentRunResult {
  top10: HotItem[];
  summary: string;
  errors: string[];
}
