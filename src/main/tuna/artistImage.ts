import { getUserAgent } from "../userAgent";

const CACHE_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;

const imageCache = new Map<string, { url: string; expires: number }>();

function channelIdFromUrl(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  try {
    const match = new URL(url).pathname.match(/\/channel\/([^/]+)/);
    return match?.[1];
  } catch {
    const match = url.match(/\/channel\/([^/?#]+)/);
    return match?.[1];
  }
}

function decodeEmbeddedJsonUrl(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw
      .replace(/\\u0026/g, "&")
      .replace(/\\\//g, "/")
      .replace(/\\"/g, '"');
  }
}

function parseArtistAvatarFromHtml(html: string): string | undefined {
  const patterns = [
    /"avatar"\s*:\s*\{\s*"thumbnails"\s*:\s*\[\s*\{\s*"url"\s*:\s*"((?:\\.|[^"\\])*)"/,
    /"musicArtistHeaderRenderer"[\s\S]{0,4000}?"thumbnails"\s*:\s*\[\s*\{\s*"url"\s*:\s*"((?:\\.|[^"\\])*)"/,
    /"channelAvatarSupportedRenderers"[\s\S]{0,800}?"thumbnails"\s*:\s*\[\s*\{\s*"url"\s*:\s*"((?:\\.|[^"\\])*)"/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) {
      continue;
    }
    const url = decodeEmbeddedJsonUrl(match[1]);
    if (
      url.startsWith("https://") &&
      (url.includes("ggpht.com") || url.includes("googleusercontent.com"))
    ) {
      return url;
    }
  }

  return undefined;
}

export async function fetchArtistImage(
  artistUrl: string | undefined,
  artistChannelId: string | undefined,
): Promise<string | undefined> {
  const channelId =
    artistChannelId ?? channelIdFromUrl(artistUrl);
  if (!channelId) {
    return undefined;
  }

  const cached = imageCache.get(channelId);
  if (cached && cached.expires > Date.now()) {
    return cached.url;
  }

  const urlsToTry = [
    `https://music.youtube.com/channel/${channelId}`,
    artistUrl,
    `https://www.youtube.com/channel/${channelId}`,
  ].filter((url, index, arr): url is string => {
    return Boolean(url) && arr.indexOf(url) === index;
  });

  for (const pageUrl of urlsToTry) {
    try {
      const response = await fetch(pageUrl, {
        headers: {
          "User-Agent": getUserAgent(),
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        continue;
      }
      const html = await response.text();
      const image = parseArtistAvatarFromHtml(html);
      if (image) {
        imageCache.set(channelId, {
          url: image,
          expires: Date.now() + CACHE_TTL_MS,
        });
        return image;
      }
    } catch {
      continue;
    }
  }

  return undefined;
}
