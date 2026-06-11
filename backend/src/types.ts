export type CamelotMode = "A" | "B";

export type CamelotKey = `${number}${CamelotMode}`;

export type Track = {
  id: string;
  artist: string;
  title: string;
  bpm: number;
  key: CamelotKey;
  genre: string;
  energy: number;
};

export type MatchType = "perfect" | "close";

export type TrackMatch = {
  track: Track;
  type: MatchType;
  bpmDelta: number;
  keyDelta: number;
  reason: string;
};
