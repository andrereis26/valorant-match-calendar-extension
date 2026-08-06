export type TimestampTimeZone = "UTC" | "local";
export type MatchFilter = "vct" | "all";
export type MatchStatus = "upcoming" | "live" | "result";
export type MatchView = "schedule" | "results";

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
  defaultMatchFilter: MatchFilter;
}

export interface Match {
  id: string | number;
  status: MatchStatus;
  start: Date;
  hasStartTime: boolean;
  end: Date | null;
  timeLabel: string;
  event: string;
  series: string;
  team1: string;
  team2: string;
  flag1: string;
  flag2: string;
  url: string;
  score1: string;
  score2: string;
  currentMap: string;
  mapNumber: string;
}
