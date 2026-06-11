import type { CamelotKey, Track } from "./types";

const BEATPORT_SEARCH_URL = "https://www.beatport.com/search";
const DEFAULT_LIMIT = 10;

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type BeatportCandidate = {
  id?: string;
  slug?: string;
  name?: string;
  title?: string;
  bpm?: string | number;
  key?: string | { name?: string; shortName?: string; camelotNumber?: string; camelotLetter?: string };
  artists?: Array<{ name?: string }>;
  artist?: string | { name?: string };
  genre?: string | { name?: string };
  image?: string | { uri?: string };
  artwork?: string | { uri?: string };
  release?: {
    image?: string | { uri?: string };
    artwork?: string | { uri?: string };
  };
  url?: string;
  href?: string;
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

  const trimmedKey = key.trim();
  const openKeyMatch = /^(\d{1,2})([dm])$/i.exec(trimmedKey);
  if (openKeyMatch) {
    const openKeyStep = Number(openKeyMatch[1]);
    const mode = openKeyMatch[2].toLowerCase() === "m" ? "A" : "B";
    const camelotStep = ((openKeyStep + 6) % 12) + 1;
    if (openKeyStep >= 1 && openKeyStep <= 12) return `${camelotStep}${mode}` as CamelotKey;
  }

  const camelotMatch = /^(\d{1,2})([ab])$/i.exec(trimmedKey);
  if (camelotMatch) {
    const step = Number(camelotMatch[1]);
    const mode = camelotMatch[2].toUpperCase();
    if (step >= 1 && step <= 12) return `${step}${mode}` as CamelotKey;
  }

  return camelotByKey[normalizeKeyName(trimmedKey)] ?? null;
}

function getString(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : undefined;
}

function absoluteBeatportUrl(value: string | undefined) {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `https://www.beatport.com${value}`;
  return value;
}

function pickImage(candidate: BeatportCandidate) {
  const possibleValues = [
    candidate.image,
    candidate.artwork,
    candidate.release?.image,
    candidate.release?.artwork,
  ];

  for (const value of possibleValues) {
    if (typeof value === "string") return absoluteBeatportUrl(value);
    if (value && typeof value === "object" && "uri" in value) {
      return absoluteBeatportUrl(getString(value.uri));
    }
  }

  return null;
}

function pickArtist(candidate: BeatportCandidate) {
  if (Array.isArray(candidate.artists)) {
    const names = candidate.artists.map((artist) => artist.name).filter(Boolean);
    if (names.length > 0) return names.join(", ");
  }

  if (typeof candidate.artist === "string") return candidate.artist;
  if (candidate.artist && typeof candidate.artist === "object") return candidate.artist.name;
  return undefined;
}

function pickGenre(candidate: BeatportCandidate) {
  if (typeof candidate.genre === "string") return candidate.genre;
  if (candidate.genre && typeof candidate.genre === "object") return candidate.genre.name;
  return "Электронная музыка";
}

function pickKey(candidate: BeatportCandidate) {
  if (typeof candidate.key === "string") return candidate.key;

  if (candidate.key && typeof candidate.key === "object") {
    const camelotNumber = getString(candidate.key.camelotNumber);
    const camelotLetter = getString(candidate.key.camelotLetter);
    if (camelotNumber && camelotLetter) return `${camelotNumber}${camelotLetter}`;

    return candidate.key.name ?? candidate.key.shortName;
  }

  return undefined;
}

function mapCandidateToTrack(candidate: BeatportCandidate, index: number): Track | null {
  const title = getString(candidate.title) ?? getString(candidate.name);
  const artist = pickArtist(candidate);
  const bpm = getNumber(candidate.bpm);
  const key = toCamelotKey(pickKey(candidate));

  if (!title || !artist || !bpm || !key) return null;

  const url = absoluteBeatportUrl(getString(candidate.url) ?? getString(candidate.href));
  const id = getString(candidate.id) ?? getString(candidate.slug) ?? `${artist}-${title}-${index}`;

  return {
    id: encodeURIComponent(id),
    title,
    artist,
    bpm,
    key,
    genre: pickGenre(candidate),
    energy: Math.max(1, Math.min(10, Math.round(bpm / 14))),
    cover_url: pickImage(candidate),
    source_url: url,
  };
}

function extractNextData(html: string): JsonValue | null {
  const match = /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!match) return null;

  try {
    return JSON.parse(match[1]) as JsonValue;
  } catch {
    return null;
  }
}

function findTrackCandidates(value: JsonValue, candidates: BeatportCandidate[] = []): BeatportCandidate[] {
  if (!value || typeof value !== "object") return candidates;

  if (Array.isArray(value)) {
    for (const item of value) findTrackCandidates(item, candidates);
    return candidates;
  }

  const object = value as Record<string, JsonValue>;
  const maybeTrack = object as BeatportCandidate;

  if (
    (typeof maybeTrack.name === "string" || typeof maybeTrack.title === "string") &&
    maybeTrack.bpm !== undefined &&
    maybeTrack.key !== undefined
  ) {
    candidates.push(maybeTrack);
  }

  for (const child of Object.values(object)) {
    findTrackCandidates(child, candidates);
  }

  return candidates;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractJsonLdCandidates(html: string): BeatportCandidate[] {
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];

  return scripts.flatMap((script) => {
    const content = /<script[^>]*>([\s\S]*?)<\/script>/i.exec(script)?.[1];
    if (!content) return [];

    try {
      return findTrackCandidates(JSON.parse(decodeHtml(content)) as JsonValue);
    } catch {
      return [];
    }
  });
}

function parseBeatportTracks(html: string, limit: number): Track[] {
  const nextData = extractNextData(html);
  const candidates = [...(nextData ? findTrackCandidates(nextData) : []), ...extractJsonLdCandidates(html)];
  const seen = new Set<string>();
  const tracks: Track[] = [];

  for (const candidate of candidates) {
    const track = mapCandidateToTrack(candidate, tracks.length);
    if (!track || seen.has(track.id)) continue;

    seen.add(track.id);
    tracks.push(track);
    if (tracks.length >= limit) break;
  }

  return tracks;
}

function isChallengePage(html: string) {
  return /Just a moment|Enable JavaScript and cookies|cf_chl|challenge-platform/i.test(html);
}

export class MusicApiService {
  private readonly cache = new Map<string, Track[]>();

  async searchTracks(query: string, limit = DEFAULT_LIMIT): Promise<Track[]> {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) return [];

    const cacheKey = `${normalizedQuery.toLowerCase()}::${limit}`;
    const cachedTracks = this.cache.get(cacheKey);
    if (cachedTracks) return cachedTracks;

    const url = new URL(BEATPORT_SEARCH_URL);
    url.searchParams.set("q", normalizedQuery);

    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru,en-US;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
      },
    });

    const html = await response.text();

    if (!response.ok) {
      throw new MusicApiError("Beatport временно недоступен", response.status || 502);
    }

    if (isChallengePage(html)) {
      throw new MusicApiError("Beatport запросил проверку браузера. Повторите попытку позже", 503);
    }

    const tracks = parseBeatportTracks(html, limit);
    this.cache.set(cacheKey, tracks);
    return tracks;
  }

  async getTrackById(id: string): Promise<Track | null> {
    for (const tracks of this.cache.values()) {
      const track = tracks.find((candidate) => candidate.id === id);
      if (track) return track;
    }

    return null;
  }
}
