// Nyaa-Player: A Kino plugin to browse Nyaa.si and play with Torcino
//
// This is a minimal implementation tailored for Torcino integration.
// It searches Nyaa.si and returns magnets directly to the Torcino resolver.

const RESOLVER = "com.kino.torcino";
const NYAA_API = "https://nyaa.si";

async function fetchNyaa(query) {
    const url = `${NYAA_API}/?page=rss&q=${encodeURIComponent(query)}&c=1_2&f=0`;
    const r = await kino.fetch(url, { timeoutMs: 15000 });
    if (!r.ok) return [];
    
    const items = [];
    const xml = r.text();
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
        const item = match[1];
        const titleMatch = /<title>(.*?)<\/title>/.exec(item);
        const magnetMatch = /<nyaa:infoHash>(.*?)<\/nyaa:infoHash>/.exec(item);
        if (titleMatch && magnetMatch) {
            items.push({
                title: titleMatch[1],
                magnet: `magnet:?xt=urn:btih:${magnetMatch[1]}&dn=${encodeURIComponent(titleMatch[1])}`
            });
        }
    }
    return items;
}

kino.register({
    async home() {
        const results = await fetchNyaa("");
        return {
            sections: [{
                title: "Anime Reciente en Nyaa",
                items: results.slice(0, 20).map((i, idx) => ({
                    id: `nyaa_${idx}`,
                    title: i.title,
                    type: "anime",
                    ref: `m:${i.magnet}` // Enlace magnet para Torcino
                }))
            }]
        };
    },

    async resolve(ctx) {
        // Extraer el magnet del ref
        const magnet = ctx.id.startsWith("m:") ? ctx.id.slice(2) : "";
        return {
            external: {
                protocol: "magnet",
                ref: magnet
            }
        };
    }
});
