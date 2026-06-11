export type MatchType = "perfect" | "close";

export type Track = {
  id: string;
  artist: string;
  title: string;
  bpm: number;
  key: string;
  genre: string;
  energy: number;
};

export type TrackMatch = {
  track: Track;
  type: MatchType;
  bpmDelta: number;
  keyDelta: number;
  reason: string;
};
