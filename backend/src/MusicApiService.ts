import type { CamelotKey, Track } from "./types";

const API_BASE_URL = "https://api.getsong.co";
const DEFAULT_LIMIT = 40;

type GetSongBpmArtist = {
  name?: string;
  genres?: string[];
};

type GetSongBpmAlbum = {
  title?: string;
  cover_url?: string;
  cover?: string;
  image?: string;
  artwork?: string;
};

type GetSongBpmSong = {
  id?: string;
  title?: string;
  uri?: string;
  tempo?: string | number;
  key_of?: string;
  open_key?: string;
  danceability?: number;
  artist?: GetSongBpmArtist;
  album?: GetSongBpmAlbum;
  cover_url?: string;
  cover?: string;
  image?: string;
  artwork?: string;
};

type SearchResponse = {
  search?: GetSongBpmSong[];
  error?: string;
};

type SongResponse = {
  song?: GetSongBpmSong;
  error?: string;
};

export class MusicApiError extends Error {
  constructor(
    message: string,
    public readonly status = 502,
  ) {
    super(message);
  }
}

const camelotByKey: Record<string, CamelotKey> = {
  ABM: "1A",
  GSHARPM: "1A",
  B: "1B",
  EBM: "2A",
  DSHARPM: "2A",
  FSHARP: "2B",
  GB: "2B",
  BBM: "3A",
  ASHARPM: "3A",
  CSHARP: "3B",
  DB: "3B",
  FM: "4A",
  AB: "4B",
  GSHARP: "4B",
  CM: "5A",
  EB: "5B",
  DSHARP: "5B",
  GM: "6A",
  BB: "6B",
  ASHARP: "6B",
  DM: "7A",
  F: "7B",
  AM: "8A",
  C: "8B",
  EM: "9A",
  G: "9B",
  BM: "10A",
  D: "10B",
  FSHARPM: "11A",
  GBM: "11A",
  A: "11B",
  CSHARPM: "12A",
  DBM: "12A",
  E: "12B",
};

function normalizeKeyName(key: string) {
  return key
    .trim()
    .replace(/♯/g, "#")
    .replace(/♭/g, "b")
    .replace(/\s+/g, "")
    .replace(/minor$/i, "m")
    .replace(/min$/i, "m")
    .replace(/major$/i, "")
    .replace(/maj$/i, "")
    .replace(/-/g, "")
    .toUpperCase()
    .replace(/#/g, "SHARP");
}

export function toCamelotKey(key: string | undefined | null): CamelotKey | null {
  if (!key) return null;

  const openKeyMatch = /^(\d{1,2})([dm])$/i.exec(key.trim());
  if (openKeyMatch) {
    const openKeyStep = Number(openKeyMatch[1]);
    const mode = openKeyMatch[2].toLowerCase() === "m" ? "A" : "B";
    const camelotStep = ((openKeyStep + 6) % 12) + 1;
    if (openKeyStep >= 1 && openKeyStep <= 12) return `${camelotStep}${mode}` as CamelotKey;
  }

  const camelotMatch = /^(\d{1,2})([ab])$/i.exec(key.trim());
  if (camelotMatch) {
    const step = Number(camelotMatch[1]);
    const mode = camelotMatch[2].toUpperCase();
    if (step >= 1 && step <= 12) return `${step}${mode}` as CamelotKey;
  }

  return camelotByKey[normalizeKeyName(key)] ?? null;
}

function pickCoverUrl(song: GetSongBpmSong) {
  return (
    song.cover_url ??
    song.cover ??
    song.image ??
    song.artwork ??
    song.album?.cover_url ??
    song.album?.cover ??
    song.album?.image ??
    song.album?.artwork ??
    null
  );
}

function mapSongToTrack(song: GetSongBpmSong): Track | null {
  const id = song.id?.trim();
  const title = song.title?.trim();
  const artist = song.artist?.name?.trim();
  const bpm = Math.round(Number(song.tempo));
  const key = toCamelotKey(song.key_of) ?? toCamelotKey(song.open_key);

  if (!id || !title || !artist || !Number.isFinite(bpm) || !key) {
    return null;
  }

  return {
    id,
    title,
    artist,
    bpm,
    key,
    genre: song.artist?.genres?.[0] ?? "Электронная музыка",
    energy: Math.max(1, Math.min(10, Math.round((song.danceability ?? 50) / 10))),
    cover_url: pickCoverUrl(song),
    source_url: song.uri ?? null,
  };
}

export class MusicApiService {
  private readonly apiKey = process.env.MUSIC_API_KEY;

  async searchTracks(query: string, limit = DEFAULT_LIMIT): Promise<Track[]> {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) return [];

    const data = await this.request<SearchResponse>("/search/", {
      type: "song",
      lookup: normalizedQuery,
      limit: String(limit),
    });

    return (data.search ?? []).map(mapSongToTrack).filter((track): track is Track => track !== null);
  }

  async getTrackById(id: string): Promise<Track | null> {
    const data = await this.request<SongResponse>("/song/", { id });
    return data.song ? mapSongToTrack(data.song) : null;
  }

  private async request<T extends { error?: string }>(path: string, params: Record<string, string>): Promise<T> {
    if (!this.apiKey) {
      throw new MusicApiError("Ключ музыкального API не настроен", 503);
    }

    const url = new URL(path, API_BASE_URL);
    url.searchParams.set("api_key", this.apiKey);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url);
    const data = (await response.json().catch(() => ({}))) as T;

    if (!response.ok || data.error) {
      throw new MusicApiError(data.error ?? "Музыкальный API временно недоступен", response.status || 502);
    }

    return data;
  }
}
