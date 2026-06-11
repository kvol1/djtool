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
  tracks: [
    {
      id: 101,
      name: "Take It Off",
      artists: [{ name: "FISHER" }],
      bpm: 126,
      key: { name: "A min" },
      genre: { name: "Tech House" },
      image: { dynamic_uri: "https://geo-media.beatport.com/image_size/{w}x{h}/wide.png" },
      release: {
        image: { dynamic_uri: "https://geo-media.beatport.com/image_size/{w}x{h}/square.jpg" },
      },
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

const notionPrimaryResponse = {
  tracks: [
    {
      id: 201,
      name: "Notion",
      artists: [{ name: "TiM TASTE" }],
      bpm: 128,
      key: { name: "F Major" },
      genre: { name: "Techno" },
    },
    {
      id: 202,
      name: "The Days",
      artists: [{ name: "NOTION" }, { name: "Chrystal" }],
      bpm: 138,
      key: { name: "B Minor" },
      genre: { name: "Dance" },
    },
  ],
};

const notionArtistResponse = {
  tracks: [
    {
      id: 203,
      name: "Hooked",
      artists: [{ name: "NOTION" }],
      bpm: 128,
      key: { name: "C# Minor" },
      genre: { name: "Bass House" },
    },
    {
      id: 204,
      name: "TV DREAMS",
      artists: [{ name: "NOTION" }],
      bpm: 134,
      key: { name: "Bb Minor" },
      genre: { name: "Garage" },
    },
  ],
};

const redirectUrl = "https://api.beatport.com/v4/auth/o/post-message/";

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
      expect(body.get("grant_type")).toBe("authorization_code");
      expect(body.get("client_id")).toBe("PUBLIC_BEATPORT_CLIENT_ID");
      expect(body.get("code")).toBe("AUTH_CODE");
      expect(body.get("redirect_uri")).toBe(redirectUrl);

      return jsonResponse({
        access_token: "ACCESS_TOKEN",
        expires_in: 3600,
        token_type: "Bearer",
      });
    }

    if (url.href === "https://api.beatport.com/v4/auth/login/") {
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        "Content-Type": "application/json",
      });

      expect(JSON.parse(init?.body?.toString() ?? "{}")).toMatchObject({
        username: "test-user",
        password: "test-password",
      });

      return new Response(JSON.stringify({ username: "test-user" }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": "sessionid=test-session; Path=/; HttpOnly",
        },
      });
    }

    if (url.href.startsWith("https://api.beatport.com/v4/auth/o/authorize/")) {
      expect(url.searchParams.get("response_type")).toBe("code");
      expect(url.searchParams.get("client_id")).toBe("PUBLIC_BEATPORT_CLIENT_ID");
      expect(url.searchParams.get("redirect_uri")).toBe(redirectUrl);
      expect(init?.headers).toMatchObject({
        Cookie: "sessionid=test-session",
      });

      return new Response(null, {
        status: 302,
        headers: {
          Location: `${redirectUrl}?code=AUTH_CODE`,
        },
      });
    }

    if (url.href.startsWith("https://api.beatport.com/v4/catalog/search/")) {
      const query = url.searchParams.get("q");
      expect(url.searchParams.get("type")).toBe("tracks");
      expect(url.searchParams.get("per_page")).toBe("30");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer ACCESS_TOKEN",
      });

      if (query === "Fisher") {
        return jsonResponse(trackResponse);
      }

      if (query === "Notion" && url.searchParams.get("artist_name") === "Notion") {
        return jsonResponse(notionArtistResponse);
      }

      if (query === "Notion") {
        return jsonResponse(notionPrimaryResponse);
      }

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
    const tracks = await musicApi.searchTracks("Fisher");

    expect(tracks.length).toBe(2);
    expect(tracks[0]).toMatchObject({
      title: "Take It Off",
      artist: "FISHER",
      bpm: 126,
      key: "8A",
      cover_url: "https://geo-media.beatport.com/image_size/500x500/square.jpg",
    });
    expect(tracks[1]).toMatchObject({
      title: "Losing It",
      artist: "FISHER",
      bpm: 125,
      key: "3B",
    });
  });

  test("combines broad and artist-focused search results", async () => {
    const musicApi = new MusicApiService();
    const tracks = await musicApi.searchTracks("Notion");

    expect(tracks.length).toBe(4);
    expect(tracks.slice(0, 3).every((track) => track.artist.includes("NOTION"))).toBe(true);
    expect(tracks[0]).toMatchObject({
      title: "Hooked",
      artist: "NOTION",
      key: "12A",
    });
  });
});
