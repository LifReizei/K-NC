<p align="center"><img src="icon.png" alt="Torcino Player" width="128"></p>

# Torcino Player — a Kino plugin

**Torrent player for Kino.** Keep your own list of magnet links, see them on Kino's Home, and play any of them with one click. The plugin hands the
magnet to the **Torcino** app, which plays the torrent while it downloads (and converts what the device cannot open).

No catalog, no accounts, no network: the plugin only tidies the magnets you add. It needs Kino 0.9.66 or newer.

## Use it

1. Install the plugin: Plugins → **+** → type `torcino/kino-plugin-torcino-player` → accept.
2. Open its settings (Ajustes → Torcino Player) and press **Agregar** for each magnet. Paste a full `magnet:?xt=urn:btih:…`
   link, or just the info hash (40 hex characters or 32 base32).
3. Each magnet shows on the Home, under the genre Kino finds for it (Películas, Series, Otros…): Kino lines every plugin's titles up by genre, so the plugin's own row names appear on its own page. Press play: Kino asks to install Torcino the first time, then opens it.

Each entry has four fields:

| Field | What it does |
| --- | --- |
| **Magnet o hash** | Required. A magnet link or a bare info hash. Quotes, angle brackets and line breaks from copy-paste are fine. |
| **Título** | Optional. Left blank, the magnet's own name is used, tidied (`The.Matrix.1999.1080p.mkv` → `The Matrix 1999 1080p`). |
| **Grupo** | Optional. Magnets with the same name form one group, shown as one row on the plugin's own page (Categorías ▸ Tus plugins); the rest go to *Mis magnets*. If the name is a Kino genre (Películas, Series, Anime, Infantil, Documentales, Deportes, Noticias, Música…) the group sits under that genre on the Home. |
| **Nº de archivo** | Optional. For a torrent with several videos (a season pack), the number of the file to play: add the same magnet once per file. |

Up to 50 magnets and 20 groups. The list **syncs to your other paired device**, so you can paste on the phone and watch on the TV
(typing a magnet with a remote is not fun).

You can also paste a magnet straight into Kino's search box to play it without saving it, and search your saved list by title.

## Posters

The plugin asks Kino (its own TMDB lookup, no key involved) for a poster by the title it guesses from the name
(`Show.Name.S02E05.720p` → a series called *Show Name*). Only an exact title match is used, so a wrong poster is rare; a title
nobody knows simply shows without one. Results are cached for 30 days (2 days for "not found") and at most 12 lookups happen per
Home load. Turn it off with **Buscar carátulas**, or clear the cache with **Borrar carátulas guardadas**.

## You need the Torcino app

Download it here: **<https://github.com/torcino/torcino/releases/latest>**

| File | For |
| --- | --- |
| `torcino-<version>-arm64-v8a.apk` (~20 MB) | almost every phone and current TV |
| `torcino-<version>-armeabi-v7a.apk` (~31 MB) | older 32-bit TV boxes |
| `torcino-<version>-universal.apk` (~84 MB) | when you do not know the CPU |

Kino can also offer to download it for you (the universal APK from that release, checked against the sha256 pinned in this
plugin's manifest).

## What it does with a magnet

- Reads the hash from `xt=urn:btih:` (hex or base32, any case), the name from `dn`, up to 8 trackers (`udp`, `http(s)`, `ws(s)`
  only), up to 3 peers (`x.pe`) and the file from `so`.
- Refuses what is not a magnet or hash, magnets with only a v2 hash (`btmh`), and anything that would not fit Kino's 2048-character
  reference. A magnet with no trackers gets a few public ones (the DHT does most of the work anyway).
- Saving the list checks every entry and says which one is wrong; entries that arrive from the other device unchecked are
  skipped on the Home, and the settings status line counts them (`3 magnets listos · 1 repetido · con error: #4`).
- The same magnet twice shows once; the same torrent with different file numbers shows once per file.

Long magnets: the field takes 500 characters. If yours is longer, delete the `&tr=…` parts or paste only the hash — the plugin adds
trackers itself.

## Develop

```
node --test test/plugin.test.mjs     # offline, a stub of the kino object
node sdk/validate.mjs .              # what Kino would accept
```

Not affiliated with Kino or with any torrent site. Torcino Player never offers or searches for content: it plays what you add.
