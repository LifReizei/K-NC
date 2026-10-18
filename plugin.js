// @ts-check
// NyaaClaw v1.1.1: Advanced Nyaa.si client with magnet link resolution for Torcino and AniList metadata.

if (typeof kino.meta !== "function") throw kino.error("unavailable", "kino.meta not available");

const NYAA_BASE = "https://nyaa.si";
const ANILIST_API = "https://graphql.anilist.co";

const DEFAULT_TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://explodie.org:6969/announce",
  "udp://open.stealth.si:80/announce",
];

function cleanTitle(rawTitle) {
  return rawTitle
    .replace(/\[.*?\]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/-\s*\d+(\s*v\d+)?(\s*\[.*?\])?$/, "")
    .replace(/1080p|720p|480p|2160p|4K|8K|HEVC|10bit|BD|Blu-ray|MULTI|DualAudio|H\.?264|AVC|H\.?265|AV1/gi, "")
    .trim();
}

async function searchNyaa(query, category = "1_2") {
  const url = `${NYAA_BASE}/?page=rss&q=${encodeURIComponent(query)}&c=${category}&f=0`;
  const r = await kino.fetch(url, { timeoutMs: 15000 });
  if (!r.ok) return [];

  const xmlText = r.text();
  const items = [];
  
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemContent = match[1];
    const getTag = (tag) => {
      const m = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\/${tag}>`, 'i').exec(itemContent);
      return m ? m[1].trim() : "";
    };

    const title = getTag("title");
    const seeders = Number(getTag("nyaa:seeders") || "0");
    const infoHash = getTag("nyaa:infoHash");
    const sizeStr = getTag("nyaa:size");
    const categoryTag = getTag("nyaa:category");

    if (title && infoHash) {
      const magnet = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(title)}` + DEFAULT_TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join("");
      items.push({
        title,
        infoHash,
        magnet,
        seeders,
        size: sizeStr,
        category: categoryTag
      });
    }
  }
  return items;
}

async function fetchAniListMetadata(searchQuery) {
  const query = `
    query ($search: String) {
      Media (search: $search, type: ANIME) {
        id
        title {
          romaji
          english
          native
        }
        coverImage {
          extraLarge
          large
        }
        bannerImage
        description
        genres
        averageScore
        episodes
        status
        seasonYear
      }
    }
  `;

  try {
    const r = await kino.fetch(ANILIST_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ query, variables: { search: searchQuery } }),
      timeoutMs: 10000
    });

    if (!r.ok) return null;
    const data = r.json();
    return data?.data?.Media || null;
  } catch {
    return null;
  }
}

function scoreTorrent(title, settings) {
  let score = 0;
  const tLower = title.toLowerCase();

  const prefQual = settings.preferredQuality || "1080p";
  if (prefQual !== "any" && tLower.includes(prefQual.toLowerCase())) score += 50;

  const prefCodec = settings.preferredCodec || "h264";
  if (prefCodec !== "any" && (tLower.includes(prefCodec.toLowerCase()) || (prefCodec === "h264" && tLower.includes("avc")))) score += 40;

  const prefAudio = settings.preferredAudio || "jp";
  if (prefAudio !== "any") {
    if (prefAudio === "jp" && (tLower.includes("japanese") || tLower.includes("jp"))) score += 30;
    if (prefAudio === "es" && (tLower.includes("spanish") || tLower.includes("latino") || tLower.includes("español"))) score += 30;
    if (prefAudio === "en" && (tLower.includes("english") || tLower.includes("dual audio"))) score += 30;
  }

  const prefSub = settings.subtitleLanguage || "es";
  if (prefSub !== "any") {
    if (prefSub === "es" && (tLower.includes("spanish") || tLower.includes("sub spanish") || tLower.includes("sub es") || tLower.includes("castellano") || tLower.includes("latino"))) score += 35;
    if (prefSub === "en" && (tLower.includes("eng") || tLower.includes("sub english") || tLower.includes("sub en"))) score += 35;
    if (prefSub === "raw" && (tLower.includes("raw") || tLower.includes("uncensored"))) score += 35;
  }

  return score;
}

kino.register({
  async home(ctx) {
    const settings = ctx.settings || {};
    const defaultCat = settings.categoryFilter || "1_2";
    const items = await searchNyaa("", defaultCat);
    
    const catalogMap = new Map();
    for (const item of items.slice(0, 30)) {
      const cleaned = cleanTitle(item.title);
      if (!catalogMap.has(cleaned) && cleaned.length > 2) {
        catalogMap.set(cleaned, {
          id: cleaned,
          title: cleaned,
          poster: "",
          type: "series"
        });
      }
    }

    return {
      sections: [
        {
          title: "Anime Reciente en Nyaa",
          items: Array.from(catalogMap.values())
        }
      ]
    };
  },

  async search(ctx) {
    const query = ctx.query || "";
    const settings = ctx.settings || {};
    const defaultCat = settings.categoryFilter || "1_2";
    const items = await searchNyaa(query, defaultCat);
    
    const catalogMap = new Map();
    for (const item of items) {
      const cleaned = cleanTitle(item.title);
      if (!catalogMap.has(cleaned) && cleaned.length > 2) {
        catalogMap.set(cleaned, {
          id: cleaned,
          title: cleaned,
          poster: "",
          type: "series"
        });
      }
    }

    return Array.from(catalogMap.values());
  },

  async meta(ctx) {
    const animeTitle = ctx.id;
    const media = await fetchAniListMetadata(animeTitle);

    if (!media) {
      return {
        id: animeTitle,
        type: "series",
        name: animeTitle,
        poster: "https://via.placeholder.com/300x450.png?text=" + encodeURIComponent(animeTitle),
        description: "Sin metadatos encontrados en AniList."
      };
    }

    return {
      id: animeTitle,
      type: "series",
      name: media.title.english || media.title.romaji || animeTitle,
      poster: media.coverImage?.extraLarge || media.coverImage?.large || "",
      background: media.bannerImage || "",
      description: media.description?.replace(/<br>/g, "\n") || "",
      genres: media.genres || [],
      imdbRating: media.averageScore ? media.averageScore / 10 : undefined,
      year: media.seasonYear,
      episodes: media.episodes ? Array.from({ length: media.episodes }, (_, i) => ({
        id: `${animeTitle}__EP__${i + 1}`,
        season: 1,
        number: i + 1,
        title: `Episodio ${i + 1}`
      })) : []
    };
  },

  async episodes(ctx) {
    const animeTitle = ctx.id;
    const media = await fetchAniListMetadata(animeTitle);
    const totalEp = media?.episodes || 24;

    return Array.from({ length: totalEp }, (_, i) => ({
      id: `${animeTitle}__EP__${i + 1}`,
      season: 1,
      number: i + 1,
      title: `Episodio ${i + 1}`
    }));
  },

  async resolve(ctx) {
    const parts = ctx.id.split("__EP__");
    const animeTitle = parts[0];
    const epNum = parts[1] ? `E${parts[1].padStart(2, '0')}` : "";

    const searchQuery = `${animeTitle} ${epNum}`.trim();
    const settings = ctx.settings || {};
    const defaultCat = settings.categoryFilter || "1_2";
    const items = await searchNyaa(searchQuery, defaultCat);

    if (items.length === 0) {
      throw kino.error("not_found", "No se encontraron torrents en Nyaa para este episodio.");
    }

    items.forEach(item => {
      item.calculatedScore = scoreTorrent(item.title, settings) + (item.seeders > 0 ? Math.min(item.seeders, 100) : 0);
    });

    items.sort((a, b) => b.calculatedScore - a.calculatedScore);

    // Return streams configured with external resolver for Torcino using magnet links
    return items.slice(0, 10).map((item) => ({
      name: `🌱 ${item.seeders} | 💾 ${item.size}`,
      title: item.title,
      external: {
        package: "com.kino.torcino",
        ref: item.magnet
      }
    }));
  }
});
