export type TimestampTimeZone = "UTC" | "local";

export interface ExtensionConfig {
  baseUrl: string;
  endpoint: string;
  headers: string;
  matchesPath: string;
  idPath: string;
  startPath: string;
  endPath: string;
  eventPath: string;
  seriesPath: string;
  team1Path: string;
  team2Path: string;
  flag1Path: string;
  flag2Path: string;
  matchUrlPath: string;
  matchPageBaseUrl: string;
  durationMinutes: number;
  timestampTimeZone: TimestampTimeZone;
}

export interface Match {
  id: string | number;
  start: Date;
  end: Date | null;
  event: string;
  series: string;
  team1: string;
  team2: string;
  flag1: string;
  flag2: string;
  url: string;
}
