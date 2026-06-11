import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { MusicApiService } from "../src/MusicApiService";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

const docsHtml = `
  <html>
    <body>
      <script src="/static/btprt/app.js"></script>
    </body>
  </html>
`;

const docsScript = `
  window.Config = {
    API_CLIENT_ID: 'PUBLIC_BEATPORT_CLIENT_ID'
  };
`;

const trackResponse = {
  results: [
    {
      id: 101,
      name: "Take It Off",
      artists: [{ name: "FISHER" }],
      bpm: 126,
      key: { name: "A min" },
      genre: { name: "Tech House" },
      image: { url: "https://geo-media.beatport.com/image.jpg" },
    },
    {
      id: 102,
      name: "Losing It",
      artists: [{ name: "FISHER" }],
      bpm: "125",
      key: { name: "C# maj" },
      genre: { name: "Tech House" },
      image: { url: "https://geo-media.beatport.com/image-2.jpg" },
    },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  process.env.BEATPORT_USERNAME = "test-user";
  process.env.BEATPORT_PASSWORD = "test-password";
  delete process.env.BEATPORT_ACCESS_TOKEN;

  globalThis.fetch = async (input, init) => {
    const url = new URL(input.toString());

    if (url.href === "https://api.beatport.com/v4/docs/") {
      return new Response(docsHtml, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }

    if (url.href === "https://api.beatport.com/static/btprt/app.js") {
      return new Response(docsScript, {
        status: 200,
        headers: { "Content-Type": "application/javascript" },
      });
    }

    if (url.href === "https://api.beatport.com/v4/auth/o/token/") {
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        "Content-Type": "application/x-www-form-urlencoded",
      });

      const body = new URLSearchParams(init?.body?.toString());
      expect(body.get("grant_type")).toBe("password");
      expect(body.get("client_id")).toBe("PUBLIC_BEATPORT_CLIENT_ID");
      expect(body.get("username")).toBe("test-user");
      expect(body.get("password")).toBe("test-password");

      return jsonResponse({
        access_token: "ACCESS_TOKEN",
        expires_in: 3600,
        token_type: "Bearer",
      });
    }

    if (url.href.startsWith("https://api.beatport.com/v4/catalog/tracks/")) {
      expect(url.searchParams.get("search")).toBe("Fisher");
      expect(url.searchParams.get("page_size")).toBe("5");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer ACCESS_TOKEN",
      });

      return jsonResponse(trackResponse);
    }

    throw new Error(`Unexpected request: ${url.href}`);
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

describe("MusicApiService", () => {
  test("searches Beatport and returns normalized track objects", async () => {
    const musicApi = new MusicApiService();
    const tracks = await musicApi.searchTracks("Fisher", 5);

    expect(tracks.length).toBe(2);
    expect(tracks[0]).toMatchObject({
      title: "Take It Off",
      artist: "FISHER",
      bpm: 126,
      key: "8A",
      cover_url: "https://geo-media.beatport.com/image.jpg",
    });
    expect(tracks[1]).toMatchObject({
      title: "Losing It",
      artist: "FISHER",
      bpm: 125,
      key: "3B",
    });
  });
});
