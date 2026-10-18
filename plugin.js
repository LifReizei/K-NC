// @ts-check
// NyaaClaw v1.1.5 - Edición Blindada
if (typeof kino.fetch !== "function") throw kino.error("unavailable", "kino.fetch not available");

const NYAA_API = "https://nyaa.si";

async function fetchNyaa(query) {
    const url = `${NYAA_API}/?page=rss&q=${encodeURIComponent(query || "")}&c=1_2&f=0`;
    const r = await kino.fetch(url, { timeoutMs: 15000 });
    if (!r.ok) return [];
    
    const xml = r.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
        const item = match[1];
        const tMatch = /<title>(.*?)<\/title>/.exec(item);
        const hMatch = /<nyaa:infoHash>(.*?)<\/nyaa:infoHash>/.exec(item);
        if (tMatch && hMatch) {
            items.push({
                title: tMatch[1],
                magnet: `magnet:?xt=urn:btih:${hMatch[1]}&dn=${encodeURIComponent(tMatch[1])}`
            });
        }
    }
    return items;
}

kino.register({
    async home(ctx) {
        const results = await fetchNyaa("");
        return {
            sections: [{
                title: "Anime Reciente (Nyaa)",
                items: results.slice(0, 20).map((i) => ({
                    id: i.magnet, // Usamos el magnet como ID directo para el resolve
                    title: i.title,
                    type: "movie" // Kino prefiere 'movie' o 'series' para el renderizado
                }))
            }]
        };
    },

    async resolve(ctx) {
        // En este modelo, el ctx.id YA ES el magnet
        return {
            external: {
                protocol: "magnet",
                ref: ctx.id
            }
        };
    }
});
