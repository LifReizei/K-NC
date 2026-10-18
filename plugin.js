// @ts-check
// NyaaClaw v1.1.2: Fixed resolve format for Kino API v11 + Torcino external resolver.

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

    if (title && infoHash) {
      const magnet = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(title)}` + DEFAULT_TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join("");
      items.push({ title, magnet, seeders, size: sizeStr });
    }
  }
  return items;
}

async function fetchAniListMetadata(searchQuery) {
  const query = `query ($search: String) { Media (search: $search, type: ANIME) { title { romaji english } coverImage { extraLarge } bannerImage description genres averageScore episodes seasonYear } }`;
  try {
    const r = await kino.fetch(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { search: searchQuery } }),
      timeoutMs: 10000
    });
    return r.ok ? r.json()?.data?.Media : null;
  } catch { return null; }
}

kino.register({
  async home(ctx) {
    const items = await searchNyaa("", "1_2");
    const catalog = new Map();
    items.forEach(i => {
      const title = cleanTitle(i.title);
      if (!catalog.has(title) && title.length > 2) catalog.set(title, { id: title, title, type: "series" });
    });
    return { sections: [{ title: "Anime en Nyaa", items: Array.from(catalog.values()) }] };
  },

  async search(ctx) {
    const items = await searchNyaa(ctx.query || "", "1_2");
    const catalog = new Map();
    items.forEach(i => {
      const title = cleanTitle(i.title);
      if (!catalog.has(title) && title.length > 2) catalog.set(title, { id: title, title, type: "series" });
    });
    return Array.from(catalog.values());
  },

  async meta(ctx) {
    const media = await fetchAniListMetadata(ctx.id);
    return {
      id: ctx.id,
      type: "series",
      name: media?.title?.english || media?.title?.romaji || ctx.id,
      poster: media?.coverImage?.extraLarge || "",
      background: media?.bannerImage || "",
      description: media?.description?.replace(/<br>/g, "\n") || "",
      episodes: media?.episodes ? Array.from({ length: media.episodes }, (_, i) => ({ id: `${ctx.id}__EP__${i + 1}`, season: 1, number: i + 1, title: `Episodio ${i + 1}` })) : []
    };
  },

  async resolve(ctx) {
    const parts = ctx.id.split("__EP__");
    const searchQuery = parts.length > 1 ? `${parts[0]} E${parts[1].padStart(2, '0')}` : parts[0];
    const items = await searchNyaa(searchQuery, "1_2");
    if (items.length === 0) throw kino.error("not_found", "No torrents found.");
    
    // Mostrando el primer resultado como un stream externo de tipo magnet
    const item = items[0];
    return {
      external: {
        protocol: "magnet",
        ref: item.magnet
      }
    };
  }
});
