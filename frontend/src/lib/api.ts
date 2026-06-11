import type { Track, TrackMatch } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ message: "Не удалось выполнить запрос" }));
    throw new Error(data.message ?? "Не удалось выполнить запрос");
  }

  return response.json() as Promise<T>;
}

export function getTracks(query: string) {
  const params = new URLSearchParams({ query });
  return request<{ tracks: Track[] }>(`/api/tracks?${params.toString()}`);
}

export function getMatches(trackId: string, query: string) {
  const params = new URLSearchParams({ query });
  return request<{ sourceTrack: Track; matches: TrackMatch[] }>(`/api/matches/${trackId}?${params.toString()}`);
}

export function verifyTelegramSession(initData: string) {
  return request<{ ok: boolean }>("/api/auth", {
    method: "POST",
    body: JSON.stringify({ initData }),
  });
}
