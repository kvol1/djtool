import type { Track, TrackMatch } from "./types";

function getApiBaseUrl() {
  const configuredUrl = (import.meta.env.VITE_API_URL ?? "").trim();
  const isBrowser = typeof window !== "undefined";
  const currentOrigin = isBrowser ? window.location.origin : "";
  const isProductionPage = isBrowser && window.location.protocol === "https:";
  const isLocalConfiguredUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(configuredUrl);

  if (configuredUrl && !(isProductionPage && isLocalConfiguredUrl)) {
    return configuredUrl;
  }

  return currentOrigin;
}

function buildApiUrl(path: string) {
  return new URL(path, getApiBaseUrl()).toString();
}

function showRequestAlert(url: string, message: string) {
  if (typeof window === "undefined") return;
  window.alert(`Ошибка запроса:\n${url}\n\n${message}`);
}

class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly alreadyAlerted = false,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit, options: { alertOnError?: boolean } = {}): Promise<T> {
  const url = buildApiUrl(path);

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ message: "Не удалось выполнить запрос" }));
      const message = data.message ?? "Не удалось выполнить запрос";

      if (options.alertOnError) {
        showRequestAlert(url, message);
      }

      throw new ApiRequestError(`${message}: ${url}`, Boolean(options.alertOnError));
    }

    return response.json() as Promise<T>;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Сетевая ошибка";

    if (options.alertOnError && !(error instanceof ApiRequestError && error.alreadyAlerted)) {
      showRequestAlert(url, message);
    }

    throw error instanceof Error ? error : new Error(`${message}: ${url}`);
  }
}

export function getTracks(query: string, limit = 30) {
  const params = new URLSearchParams({ query, limit: String(limit) });
  return request<{ tracks: Track[] }>(`/api/tracks?${params.toString()}`, undefined, { alertOnError: true });
}

export function getMatches(trackId: string, query: string, limit = 100) {
  const params = new URLSearchParams({ query, limit: String(limit) });
  return request<{ sourceTrack: Track; matches: TrackMatch[] }>(`/api/matches/${trackId}?${params.toString()}`, undefined, {
    alertOnError: true,
  });
}

export function verifyTelegramSession(initData: string) {
  return request<{ ok: boolean }>("/api/auth", {
    method: "POST",
    body: JSON.stringify({ initData }),
  });
}
