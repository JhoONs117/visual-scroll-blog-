# Schema JSON v2 — Articoli del sistema

Versione: 2 | Aggiornato: 2026-05-14

---

## Campi obbligatori

| Campo | Tipo | Descrizione |
|---|---|---|
| `schema_version` | `number` | Sempre `2` per articoli v2 |
| `agent` | `string` | Identificatore agente (vedi valori validi) |
| `slug` | `string` | Identificatore URL-safe univoco dell'articolo |
| `title` | `string` | Titolo originale dell'articolo/ricetta |
| `link` | `string` | URL sorgente dell'articolo |
| `pubDate` | `string` | Data di pubblicazione originale (RSS) |
| `savedAt` | `string` | ISO 8601 — quando l'articolo è stato processato |
| `prompt_version` | `string` | Versione del prompt usato (es. `"1.0.0"`) |
| `status` | `string` | Stato del ciclo di vita (vedi valori validi) |
| `image` | `string` | URL immagine slide 1 (og:image dalla sorgente) |
| `slides` | `string[]` | Array di esattamente **5 stringhe** — slide testuali |
| `carousel_slides` | `object[]` | Array di esattamente **5 oggetti** (vedi struttura sotto) |
| `formats` | `object` | Contenuti per canale (vedi struttura sotto) |
| `metrics` | `object` | Metriche per canale (struttura sotto) |

---

## Valori validi per `status`

| Valore | Significato |
|---|---|
| `draft` | Generato, non ancora revisionato |
| `approved` | Approvato manualmente da review.html |
| `scheduled` | Pianificato per pubblicazione automatica |
| `published` | Pubblicato su almeno un canale |
| `failed` | Pubblicazione fallita (dopo max retry) |

Flusso: `draft` → `approved` → `scheduled` → `published` / `failed`

---

## Valori validi per `agent`

| Valore | Agente |
|---|---|
| `ai-news` | Pipeline notizie AI (TechCrunch, AI News, O'Reilly) |
| `food` | Pipeline ricette food (Giallozafferano) |

---

## Struttura `carousel_slides`

Ogni oggetto nell'array ha:

| Campo | Tipo | Obbligatorio | Descrizione |
|---|---|---|---|
| `hook` | `string` | ✅ | Titolo breve della slide |
| `description` | `string` | ✅ | Testo corpo della slide |
| `visual_hint` | `string` | ✓ | Suggerimento visivo per l'immagine |
| `layout_type` | `string` | ✓ | `hero` \| `right-focus` \| `sensor-zoom` \| `human-hand` \| `cta-final` |
| `icon` | `string` | ✓ | `tag` \| `waves` \| `heart` \| `vibration` \| `check` |
| `image_query` | `string` | ✓ | Query Pexels per l'immagine di sfondo |
| `image` | `string` | — | URL immagine Pexels (assente sulla slide 1 che usa `article.image`) |

---

## Struttura `formats`

```json
{
  "formats": {
    "x": {
      "thread": ["tweet 1", "tweet 2", "tweet 3", "tweet 4", "tweet 5"]
    },
    "instagram": {
      "caption": "Testo caption Instagram...",
      "carousel": []
    },
    "tiktok": {
      "script": ["riga 1", "riga 2", "riga 3", "riga 4", "riga 5"]
    }
  }
}
```

| Campo | Tipo | Lunghezza |
|---|---|---|
| `formats.x.thread` | `string[]` | Esattamente 5 elementi |
| `formats.instagram.caption` | `string` | Non vuota |
| `formats.instagram.carousel` | `array` | Copia di `carousel_slides` (può essere `[]`) |
| `formats.tiktok.script` | `string[]` | Esattamente 5 elementi |

---

## Alias legacy

Per garantire compatibilità con il frontend e gli script esistenti, i tre alias
vengono scritti in parallelo ai campi `formats.*` al momento del salvataggio.

| Alias (root) | Corrisponde a |
|---|---|
| `thread_text` | `formats.x.thread` |
| `instagram_caption` | `formats.instagram.caption` |
| `video_script` | `formats.tiktok.script` |

**Regola:** se un alias è presente, deve essere **identico** al campo `formats.*` corrispondente.
Dopo la migrazione al runner unico (FASE 5–7), i nuovi articoli avranno solo `formats.*`
e gli alias potranno essere rimossi.

---

## Struttura `metrics`

Oggetto vuoto per ora — da riempire manualmente dopo ogni pubblicazione.

```json
{
  "metrics": {
    "x": {},
    "instagram": {},
    "tiktok": {}
  }
}
```

Campi futuri previsti per `metrics.x`: `impressions`, `bookmarks`, `replies`, `reposts`, `publishedAt`.

---

## Campi opzionali per agente

### Solo agente `food`

| Campo | Tipo | Descrizione |
|---|---|---|
| `dish_type` | `string` | Categoria piatto: `pasta` \| `meat` \| `fish` \| `soup` \| `dessert` \| `salad` \| `vegetable` \| `generic` |
| `signature_ingredients` | `string[]` | Ingredienti chiave della ricetta (3–5 elementi) |
| `sourceId` | `string` | Hash md5 dell'URL sorgente (deduplicazione) |

---

## Esempio completo — AI news

```json
{
  "schema_version": 2,
  "agent": "ai-news",
  "slug": "riding-an-ai-rally-robinhood-preps-second-retail-v",
  "title": "Riding an AI rally, Robinhood preps second retail venture IPO",
  "link": "https://techcrunch.com/2026/05/11/riding-an-ai-rally-robinhood-preps-second-retail-venture-ipo/",
  "pubDate": "Tue, 12 May 2026 00:09:01 +0000",
  "savedAt": "2026-05-12T13:59:15.704Z",
  "image": "https://techcrunch.com/wp-content/uploads/2026/05/vlad-tenev-robinhood.jpg",
  "prompt_version": "1.0.0",
  "status": "draft",

  "slides": [
    "Robinhood cavalca l'IA, ma la prossima mossa è retail?",
    "Prepara la seconda IPO per una società di vendita al dettaglio",
    "La prima IPO retail ha perso il 90% in borsa",
    "Chi investe ora scommette su un'inversione di tendenza",
    "Guarda il roadshow: decidi se il rischio è calcolato"
  ],

  "carousel_slides": [
    { "hook": "Prima IPO perse il 90%", "description": "...", "visual_hint": "...", "layout_type": "hero", "icon": "tag", "image_query": "stock market crash" },
    { "hook": "Stessa strategia?",       "description": "...", "visual_hint": "...", "layout_type": "right-focus", "icon": "waves", "image_query": "falling dominos", "image": "https://images.pexels.com/..." },
    { "hook": "AI taglia costi",          "description": "...", "visual_hint": "...", "layout_type": "sensor-zoom", "icon": "heart", "image_query": "robot arm", "image": "https://images.pexels.com/..." },
    { "hook": "Scommessa su inversione",  "description": "...", "visual_hint": "...", "layout_type": "human-hand", "icon": "vibration", "image_query": "arrow up", "image": "https://images.pexels.com/..." },
    { "hook": "Rischio a prezzo Netflix", "description": "...", "visual_hint": "...", "layout_type": "cta-final", "icon": "check", "image_query": "chart", "image": "https://images.pexels.com/..." }
  ],

  "formats": {
    "x": {
      "thread": ["tweet 1...", "tweet 2...", "tweet 3...", "tweet 4...", "tweet 5..."]
    },
    "instagram": {
      "caption": "Robinhood ha già bruciato il 90% del valore con la sua prima IPO retail...",
      "carousel": []
    },
    "tiktok": {
      "script": ["Prima IPO, più ottimismo, crollo totale.", "Ora ripetono, ma con AI.", "Tornerà retail?", "Roadshow tra fiducia e scetticismo.", "Scommessa o calcolo? Decidi ora."]
    }
  },

  "thread_text": ["tweet 1...", "tweet 2...", "tweet 3...", "tweet 4...", "tweet 5..."],
  "instagram_caption": "Robinhood ha già bruciato il 90% del valore con la sua prima IPO retail...",
  "video_script": ["Prima IPO, più ottimismo, crollo totale.", "Ora ripetono, ma con AI.", "Tornerà retail?", "Roadshow tra fiducia e scetticismo.", "Scommessa o calcolo? Decidi ora."],

  "metrics": {
    "x": {},
    "instagram": {},
    "tiktok": {}
  }
}
```

---

## Esempio completo — food

```json
{
  "schema_version": 2,
  "agent": "food",
  "slug": "risotto-con-zucchine-e-pancetta",
  "sourceId": "434c565c743e28e8e08ab40c905d8cd0",
  "dish_type": "generic",
  "signature_ingredients": ["zucchine", "pancetta", "parmigiano"],
  "title": "Risotto con zucchine e pancetta",
  "link": "https://ricette.giallozafferano.it/Risotto-con-zucchine-e-pancetta.html",
  "pubDate": "Wed, 22 Apr 2026 14:46:00 +0200",
  "savedAt": "2026-05-12T14:00:43.224Z",
  "image": "https://www.giallozafferano.it/images/361-36107/Risotto-con-zucchine-e-pancetta_650x433_wm.jpg",
  "prompt_version": "1.0.0",
  "status": "draft",

  "slides": [
    "Risotto cremoso zucchine e pancetta croccante",
    "Riso, zucchine, pancetta, brodo, parmigiano",
    "Taglia zucchine e pancetta a cubetti",
    "Manteca con burro e parmigiano a fuoco spento",
    "Decora con pancetta croccante tenuta da parte"
  ],

  "carousel_slides": [
    { "hook": "Risotto cremoso zucchine e pancetta", "description": "...", "visual_hint": "...", "layout_type": "hero",         "icon": "tag",       "image_query": "savory risotto zucchini pancetta" },
    { "hook": "Gli ingredienti perfetti",             "description": "...", "visual_hint": "...", "layout_type": "right-focus",  "icon": "waves",     "image_query": "savory risotto ingredients", "image": "https://images.pexels.com/..." },
    { "hook": "Taglia a cubetti",                     "description": "...", "visual_hint": "...", "layout_type": "sensor-zoom",  "icon": "heart",     "image_query": "savory cutting zucchini", "image": "https://images.pexels.com/..." },
    { "hook": "Manteca fuori dal fuoco",              "description": "...", "visual_hint": "...", "layout_type": "human-hand",   "icon": "vibration", "image_query": "savory risotto mantecatura", "image": "https://images.pexels.com/..." },
    { "hook": "Pancetta croccante finale",            "description": "...", "visual_hint": "...", "layout_type": "cta-final",    "icon": "check",     "image_query": "savory risotto plate", "image": "https://images.pexels.com/..." }
  ],

  "formats": {
    "x": {
      "thread": ["tweet 1...", "tweet 2...", "tweet 3...", "tweet 4...", "tweet 5..."]
    },
    "instagram": {
      "caption": "Un primo che sa di casa, ma con quel tocco croccante...",
      "carousel": []
    },
    "tiktok": {
      "script": ["Taglio zucchine e pancetta a cubetti.", "Faccio rosolare la pancetta...", "Tosto il riso...", "Unisco le zucchine...", "Spengo, manteco con burro..."]
    }
  },

  "thread_text": ["tweet 1...", "tweet 2...", "tweet 3...", "tweet 4...", "tweet 5..."],
  "instagram_caption": "Un primo che sa di casa, ma con quel tocco croccante...",
  "video_script": ["Taglio zucchine e pancetta a cubetti.", "Faccio rosolare la pancetta...", "Tosto il riso...", "Unisco le zucchine...", "Spengo, manteco con burro..."],

  "metrics": {
    "x": {},
    "instagram": {},
    "tiktok": {}
  }
}
```
