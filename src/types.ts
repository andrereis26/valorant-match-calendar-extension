export type TimestampTimeZone = "UTC" | "local";
export type MatchFilter = "vct" | "all";
export type MatchEndpointKey = "upcoming" | "live" | "results";
export type MatchStatus = "upcoming" | "live" | "result";
export type MatchView = "schedule" | "results";

export interface MatchResponseMapping {
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
  score1Path: string;
  score2Path: string;
  team1RoundCtPath: string;
  team1RoundTPath: string;
  team2RoundCtPath: string;
  team2RoundTPath: string;
  currentMapPath: string;
  mapNumberPath: string;
  timeLabelPath: string;
}

export interface MatchEndpointConfig {
  endpoint: string;
  mapping: MatchResponseMapping;
}

export interface ExtensionConfig {
  baseUrl: string;
  headers: string;
  endpoints: Record<MatchEndpointKey, MatchEndpointConfig>;
  matchPageBaseUrl: string;
  durationMinutes: number;
  timestampTimeZone: TimestampTimeZone;
  defaultMatchFilter: MatchFilter;
  liveNotificationsEnabled: boolean;
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
  team1RoundCt: string;
  team1RoundT: string;
  team2RoundCt: string;
  team2RoundT: string;
  currentMap: string;
  mapNumber: string;
}
