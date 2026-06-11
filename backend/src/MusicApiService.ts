import type { CamelotKey, Track } from "./types";

const BEATPORT_API_BASE_URL = "https://api.beatport.com/v4";
const BEATPORT_DOCS_URL = `${BEATPORT_API_BASE_URL}/docs/`;
const TOKEN_URL = `${BEATPORT_API_BASE_URL}/auth/o/token/`;
const REDIRECT_URL = `${BEATPORT_API_BASE_URL}/auth/o/post-message/`;
const DEFAULT_LIMIT = 5;

type BeatportTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

type BeatportImage = {
  id?: number | string;
  uri?: string;
  url?: string;
};

type BeatportNameObject = {
  id?: number | string;
  name?: string;
  slug?: string;
};

type BeatportKey = {
  name?: string;
  short_name?: string;
  shortName?: string;
  camelot_number?: number | string;
  camelotNumber?: number | string;
  camelot_letter?: string;
  camelotLetter?: string;
};

type BeatportTrack = {
  id?: number | string;
  name?: string;
  title?: string;
  bpm?: number | string;
  key?: string | BeatportKey;
  artists?: BeatportNameObject[];
  artist?: string | BeatportNameObject;
  genre?: string | BeatportNameObject;
  genres?: BeatportNameObject[];
  image?: string | BeatportImage;
  images?: BeatportImage[];
  artwork?: string | BeatportImage;
  release?: {
    name?: string;
    image?: string | BeatportImage;
    images?: BeatportImage[];
    artwork?: string | BeatportImage;
  };
  url?: string;
  href?: string;
  slug?: string;
};

type BeatportSearchResponse = {
  results?: BeatportTrack[] | Record<string, BeatportTrack[]>;
  tracks?: BeatportTrack[];
  data?: BeatportTrack[];
  items?: BeatportTrack[];
  detail?: string;
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

function pickImageValue(value: unknown) {
  if (typeof value === "string") return absoluteBeatportUrl(value);
  if (value && typeof value === "object") {
    const image = value as BeatportImage;
    return absoluteBeatportUrl(getString(image.uri) ?? getString(image.url));
  }

  return null;
}

function pickImage(track: BeatportTrack) {
  const images = [
    track.image,
    track.artwork,
    track.images?.[0],
    track.release?.image,
    track.release?.artwork,
    track.release?.images?.[0],
  ];

  for (const image of images) {
    const url = pickImageValue(image);
    if (url) return url;
  }

  return null;
}

function pickArtist(track: BeatportTrack) {
  if (Array.isArray(track.artists)) {
    const names = track.artists.map((artist) => artist.name).filter(Boolean);
    if (names.length > 0) return names.join(", ");
  }

  if (typeof track.artist === "string") return track.artist;
  if (track.artist && typeof track.artist === "object") return track.artist.name;
  return undefined;
}

function pickGenre(track: BeatportTrack) {
  if (Array.isArray(track.genres) && track.genres[0]?.name) return track.genres[0].name;
  if (typeof track.genre === "string") return track.genre;
  if (track.genre && typeof track.genre === "object" && track.genre.name) return track.genre.name;
  return "Электронная музыка";
}

function pickKey(track: BeatportTrack) {
  if (typeof track.key === "string") return track.key;

  if (track.key && typeof track.key === "object") {
    const camelotNumber = getString(track.key.camelot_number) ?? getString(track.key.camelotNumber);
    const camelotLetter = getString(track.key.camelot_letter) ?? getString(track.key.camelotLetter);
    if (camelotNumber && camelotLetter) return `${camelotNumber}${camelotLetter}`;

    return track.key.name ?? track.key.short_name ?? track.key.shortName;
  }

  return undefined;
}

function extractTracks(response: BeatportSearchResponse) {
  if (Array.isArray(response.results)) return response.results;
  if (response.results && Array.isArray(response.results.tracks)) return response.results.tracks;
  if (Array.isArray(response.tracks)) return response.tracks;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.items)) return response.items;
  return [];
}

function mapBeatportTrack(track: BeatportTrack): Track | null {
  const id = getString(track.id);
  const title = getString(track.name) ?? getString(track.title);
  const artist = pickArtist(track);
  const bpm = getNumber(track.bpm);
  const key = toCamelotKey(pickKey(track));

  if (!id || !title || !artist || !bpm || !key) return null;

  return {
    id,
    title,
    artist,
    bpm,
    key,
    genre: pickGenre(track),
    energy: Math.max(1, Math.min(10, Math.round(bpm / 14))),
    cover_url: pickImage(track),
    source_url: absoluteBeatportUrl(getString(track.url) ?? getString(track.href) ?? (track.slug ? `/track/${track.slug}/${id}` : undefined)),
  };
}

export class MusicApiService {
  private readonly username = process.env.BEATPORT_USERNAME;
  private readonly password = process.env.BEATPORT_PASSWORD;
  private readonly cache = new Map<string, Track[]>();
  private publicClientId: string | null = null;
  private accessToken: string | null = process.env.BEATPORT_ACCESS_TOKEN ?? null;
  private tokenExpiresAt = this.accessToken ? Date.now() + 45 * 60 * 1000 : 0;

  async searchTracks(query: string, limit = DEFAULT_LIMIT): Promise<Track[]> {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) return [];

    const cacheKey = `${normalizedQuery.toLowerCase()}::${limit}`;
    const cachedTracks = this.cache.get(cacheKey);
    if (cachedTracks) return cachedTracks;

    const token = await this.getAccessToken();
    const url = new URL(`${BEATPORT_API_BASE_URL}/catalog/tracks/`);
    url.searchParams.set("search", normalizedQuery);
    url.searchParams.set("page_size", String(limit));

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = (await response.json().catch(() => ({}))) as BeatportSearchResponse;

    if (!response.ok) {
      throw new MusicApiError(data.detail ?? "Beatport API временно недоступен", response.status || 502);
    }

    const tracks = extractTracks(data)
      .map(mapBeatportTrack)
      .filter((track): track is Track => track !== null)
      .slice(0, limit);

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

  private async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    if (!this.username || !this.password) {
      throw new MusicApiError(
        "Beatport API не настроен: добавьте BEATPORT_USERNAME и BEATPORT_PASSWORD",
        503,
      );
    }

    const clientId = await this.getPublicClientId();
    const { authCode } = await this.authorizeWithCredentials(clientId);
    const body = this.buildAuthorizationCodeBody(clientId, authCode);

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const data = (await response.json().catch(() => ({}))) as BeatportTokenResponse & { error?: string; error_description?: string };

    if (!response.ok || !data.access_token) {
      throw new MusicApiError(data.error_description ?? data.error ?? "Не удалось получить токен Beatport API", response.status || 502);
    }

    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + Math.max(60, (data.expires_in ?? 3600) - 60) * 1000;
    return this.accessToken;
  }

  private async getPublicClientId() {
    if (this.publicClientId) return this.publicClientId;

    const docsResponse = await fetch(BEATPORT_DOCS_URL, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!docsResponse.ok) {
      throw new MusicApiError("Не удалось загрузить настройки Beatport API", docsResponse.status || 502);
    }

    const html = await docsResponse.text();
    const scriptPaths = [...html.matchAll(/<script[^>]+src=["']([^"']+\.js)["'][^>]*>/gi)].map((match) => match[1]);

    for (const scriptPath of scriptPaths) {
      const scriptUrl = new URL(scriptPath, BEATPORT_DOCS_URL);
      const scriptResponse = await fetch(scriptUrl, {
        headers: {
          Accept: "application/javascript,text/javascript,*/*",
          "User-Agent": "Mozilla/5.0",
        },
      });

      if (!scriptResponse.ok) continue;

      const script = await scriptResponse.text();
      const clientId =
        /API_CLIENT_ID\s*:\s*["']([^"']+)["']/.exec(script)?.[1] ??
        /clientId\s*:\s*["']([^"']+)["']/.exec(script)?.[1] ??
        /client_id["']?\s*[:=]\s*["']([A-Za-z0-9_-]{20,})["']/.exec(script)?.[1];

      if (clientId) {
        this.publicClientId = clientId;
        return clientId;
      }
    }

    throw new MusicApiError("Не удалось найти публичный client_id Beatport", 503);
  }

  private async authorizeWithCredentials(clientId: string) {
    const cookieJar = new Map<string, string>();
    const loginResponse = await fetch(`${BEATPORT_API_BASE_URL}/auth/login/`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
      },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
      }),
    });

    this.storeCookies(cookieJar, loginResponse.headers);

    const loginData = (await loginResponse.json().catch(() => ({}))) as { username?: string; email?: string; detail?: string };
    if (!loginResponse.ok || !loginData.username) {
      throw new MusicApiError(loginData.detail ?? "Beatport не принял логин или пароль", loginResponse.status || 401);
    }

    const authorizeUrl = new URL(`${BEATPORT_API_BASE_URL}/auth/o/authorize/`);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URL);

    const authorizeResponse = await fetch(authorizeUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/json",
        Cookie: this.formatCookieHeader(cookieJar),
        "User-Agent": "Mozilla/5.0",
      },
      redirect: "manual",
    });

    this.storeCookies(cookieJar, authorizeResponse.headers);

    const location = authorizeResponse.headers.get("location");
    if (!location) {
      const body = await authorizeResponse.text().catch(() => "");
      throw new MusicApiError(`Beatport не вернул код авторизации: ${body.slice(0, 180)}`, authorizeResponse.status || 502);
    }

    const redirectUrl = new URL(location, BEATPORT_API_BASE_URL);
    const authCode = redirectUrl.searchParams.get("code");

    if (!authCode) {
      throw new MusicApiError("Beatport не вернул код авторизации", 502);
    }

    return { authCode };
  }

  private storeCookies(cookieJar: Map<string, string>, headers: Headers) {
    const cookieHeaders =
      typeof headers.getSetCookie === "function"
        ? headers.getSetCookie()
        : (headers.get("set-cookie")?.split(/,(?=[^;,]+=)/g) ?? []);

    for (const cookieHeader of cookieHeaders) {
      const [cookie] = cookieHeader.split(";");
      const separatorIndex = cookie.indexOf("=");
      if (separatorIndex === -1) continue;

      cookieJar.set(cookie.slice(0, separatorIndex), cookie.slice(separatorIndex + 1));
    }
  }

  private formatCookieHeader(cookieJar: Map<string, string>) {
    return [...cookieJar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
  }

  private buildAuthorizationCodeBody(clientId: string, authCode: string) {
    return new URLSearchParams({
      code: authCode,
      client_id: clientId,
      redirect_uri: REDIRECT_URL,
      grant_type: "authorization_code",
    });
  }
}
