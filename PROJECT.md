# Visual AI Scroll Blog — PROJECT

Documento unificato: stato attuale · roadmap · riferimento tecnico · storico.  
Aggiornato: 2026-05-11 | Sostituisce: README.md · CONTEXT.md · LAVORO.md · M21-roadmap.md  
Documento operativo correlato: **MANUAL.md** (come eseguire le operazioni)

---

## 1. Stato attuale

**Data:** 2026-05-11 | **Articoli:** 67 unici | **Pipeline:** automatica ogni 2 ore (GitHub Actions) | **Deploy:** Railway

| Milestone | Stato | Note |
|---|---|---|
| M1–M13 — Setup, pipeline, deploy | ✅ Completa | Base funzionante su Railway |
| M14 — Riscrittura prompt slide | ✅ Completa | Hook narrativi, 5 ruoli fissi, fallback ~8% |
| M16 — Output multi-formato | ✅ Completa | `thread_text[5]` + `video_script[5]` per articolo |
| M17 — Pagina di review | ✅ Completa | `review.html` dark theme, "Copia tutto", data relativa |
| Backfill formati | ✅ Completa | 75 da cache + 11 da API → 44 articoli unici |
| M15 — Frontend UX a due assi | ✅ Completa | 7/7 scenari test su mobile reale |
| Bug: cross-run dedup | ✅ Fix | Stesso articolo non viene più scritto 18x |
| Bug: GENERATE_FORMATS in CI | ✅ Fix | Aggiunto a `pipeline.yml` |
| Bug: ordinamento articoli | ✅ Fix | Articoli più recenti prima in `data.js` |
| Bug: data relativa | ✅ Fix | `timeAgo()` in `index.html` e `review.html` |
| PRE-M21: fix prompt tensione irrisolta | ✅ Fix | `generateSlides` + `generateFormats` aggiornati, 45/45 rigenerati |
| PRE-M21: link fonte negli articoli | ✅ Fix | `run.js` salva `link`; "↗ Fonte" o "↗ Cerca" in review + index |
| M21b — Carousel Instagram | ✅ Completa | `carousel_slides` + Pexels slide 2-5 + og:image slide 1. 58/58 ✅ |
| Upgrade Pexels (era Wikimedia) | ✅ Completa | `fetchPexelsImage` portrait large2x in `fetch.js`; ultime 20 backfillate |
| Download PNG carousel | ✅ Completa | html2canvas 1080×1350px (4:5), modal + bottoni in `carousel.html` |
| Bug: `article.image` mancante in run.js | ✅ Fix | `fetchArticleImage` ora chiamata in `run.js` su ogni nuovo articolo |
| M21 — Test distribuzione reale | 🔄 In corso | Primo post 2026-05-11 ore 15:00 IT su X. 1 thread/giorno |
| M22 — Iterazione prompt da dati | ⏳ Dopo M21 | Richiede 15 post con dati reali |
| FASE 5 — Secondo canale | ⏳ Dopo M22 | Instagram + TikTok |
| FASE 6 — Automazione | ⏳ Dopo FASE 5 | Playwright export + auto-pubblicazione |
| M18 — Ranking per qualità | ⏳ Backlog | Nice to have |
| M19 — Index globale articoli | ⏳ Backlog | Utile quando il volume cresce |
| M20 — Branding e URL pulito | ⏳ Backlog | - |

**Ordine di esecuzione:**
```
M1-M13 ✅ → M14 ✅ → M16 ✅ → M17 ✅ → Backfill ✅ → M15 ✅ → PRE-M21 ✅ → M21b ✅
→ Pexels ✅ → Download PNG ✅
→ M21 🔄 ← STOP: valuta risultati (15 post, iniziato 2026-05-11)
→ M22 → FASE 5 → FASE 6 → M18 → M19 → M20
```

---

## 2. Progetto

**Cos'è:** sistema automatico che recupera articoli AI da feed RSS ogni 2 ore, li filtra, genera 5 slide + thread X + script video per ciascuno, e li mostra come feed scrollabile stile Instagram Stories su Railway.

### Stack

| Layer | Tool | Note |
|---|---|---|
| Runtime | Node.js | - |
| AI filter + contenuto | DeepSeek (`deepseek-chat`) | Costo basso — usato solo in produzione |
| AI sviluppo | Claude Code | Qualità alta — solo in dev, mai a runtime |
| Feed | rss-parser | - |
| HTTP | axios | - |
| Cache | md5 + `cache.json` | Hash su titolo normalizzato |
| Env | dotenv | `.env` locale + Railway vars + GitHub Secrets |
| Frontend | HTML/CSS puro | Nessuna dipendenza esterna |
| CI/CD | GitHub Actions | Cron ogni 2 ore, auto-commit output |
| Hosting | Railway | Auto-deploy su push, `npm start` → `node server.js` |
| Immagini | Pexels API | Portrait large2x, 200 req/ora free tier |

### File principali

| File | Ruolo |
|---|---|
| `run.js` | Entry point — orchestra pipeline, dedup cross-run, scrive `frontend/data.js` |
| `server.js` | HTTP server minimale — serve `frontend/` su Railway |
| `fetch.js` | RSS feed + `fetchPexelsImage(query)` + `fetchArticleImage(url)` |
| `filter.js` | `deduplicate`, `hardFilter`, `batchAIFilter` |
| `deepseek.js` | Wrapper `callDeepSeek(prompt)` → stringa risposta |
| `generate.js` | `generateSlides` + `generateFormats` + `generateCarouselSlides` — con cache |
| `validate.js` | `isValid`, `validateWithFallback` → `review_queue.json` |
| `backfill.js` | Backfill `thread_text`/`video_script` su articoli esistenti |
| `backfill-carousel.js` | Backfill `carousel_slides` + Pexels + `article.image` — flag `--force`, `--last N` |
| `regenerate-all.js` | Rigenera slide + formati per tutti gli articoli unici con prompt aggiornati |
| `backfill-links.js` | Aggiunge retroattivamente il campo `link` dai feed RSS |
| `cache.json` | Cache persistente hash→slides |
| `review_queue.json` | Articoli falliti dopo 2 tentativi di validazione |
| `output/` | JSON generati, uno per articolo (`timestamp_slug.json`) |
| `frontend/index.html` | Feed mobile: scroll verticale (cambia notizia) + orizzontale (cambia slide) |
| `frontend/review.html` | Pagina review locale: thread X, script video, "Copia tutto" per articolo |
| `frontend/carousel.html` | Preview carousel 270×337px + download PNG 1080×1350px per Instagram |
| `frontend/data.js` | Generato da `run.js` — `window.ARTICLES = [...]`, ordinato per `savedAt` desc |
| `.github/workflows/pipeline.yml` | GitHub Actions — cron `0 */2 * * *`, `GENERATE_FORMATS=true` |
| `test-distribuzione.md` | Log giornaliero dei post M21 su X |
| `MANUAL.md` | Manuale operativo: come modificare sorgenti, backfill, scaricare PNG |

### Flusso autonomo

```
ogni 2 ore
  └── GitHub Actions esegue run.js
        └── fetch RSS → deduplicate → hardFilter → batchAIFilter
              └── generateSlides + generateFormats + generateCarouselSlides
                    └── fetchPexelsImage (slide 2-5) + fetchArticleImage (slide 1)
                          └── salva output/*.json + frontend/data.js
                                └── git commit + push
                                      └── Railway autodeploy (~1 min)
                                            └── sito aggiornato online
```

### Note operative

- **Feed O'Reilly** restituisce 404 — ignorato automaticamente
- **DeepSeek cost**: pochi centesimi per run; la cache azzera il costo sugli articoli già visti
- **GitHub Actions**: gratuito fino a 2000 min/mese — il progetto ne usa ~30/mese
- **Pexels API**: free tier, 200 req/ora, 20.000/mese — sufficiente (4-8 nuovi articoli/run = 16-32 chiamate)
- **Backfill selettivo**: `node backfill-carousel.js --force --last N` per aggiornare gli N più recenti
- **Token GitHub**: serve scope `workflow` per pushare `.github/workflows/`
- **Nota crescita**: quando `data.js` pesa sul browser (centinaia di articoli), aggiungere `articles.slice(-50)` in `run.js` prima di scrivere il file

---

## 3. M21 — Test distribuzione reale (🔄 in corso)

### FASE 0 — Cosa stiamo misurando

NON stiamo cercando follower, viralità o monetizzazione. Stiamo cercando:
- Pattern di hook che fermano il lettore
- Temi AI che generano attenzione reale
- Segnali di retention autentici (bookmark, reply, tempo di permanenza)

Questo cambia radicalmente l'interpretazione dei numeri.

### PRE-M21 — Intervento prompt ✅ (2026-05-07)

Tre problemi strutturali identificati su 3 articoli reali (Governance AI, CopilotKit, Fervo Energy) e risolti prima di pubblicare.

**Problema 1 — Slide come titoli di giornale, non micro-hook** → Fix: aggiunto in `generateSlides()` vincolo "tensione irrisolta": ogni slide deve contenere domanda aperta o info incompleta che si chiude nella slide successiva.

**Problema 2 — Thread finiscono con frasi valutative vuote** → Fix: `generateFormats` aggiornato — tweet 5 chiude con fatto netto, conseguenza concreta o domanda aperta.

**Problema 3 — Thread riscrive le slide invece di amplificarle** → Fix: `generateFormats` aggiornato — tweet 1 sceglie la slide con più tensione narrativa indipendentemente dalla posizione.

Criteri verificati 3/3 su tutti e tre gli articoli di test. `regenerate-all.js`: **45/45 articoli rigenerati**, 0 fallimenti.

### Struttura `test-distribuzione.md`

```
# Test Distribuzione M21
Piattaforma: X/Twitter
Orario fisso: 15:00 IT
Data inizio: 2026-05-11

## Coda articoli
| # | Titolo | Hook (Tweet 1) | Tipo hook | Note |

## Log pubblicazioni
| Thread | Data | Hook | Slide origine | Impression | Bookmark | Reply | Repost | Note |

## Pattern vincenti (dopo 15 post)
- Hook che hanno performato / Hook che non hanno funzionato
- Topic migliori / Topic peggiori
- Slide origine più frequente per tweet 1

## Decisioni per M22
```

### Istruzioni giornaliere (15 giorni, ore 15:00 IT)

1. Apri `review.html`
2. Copia il `thread_text` dell'articolo del giorno
3. Postalo su X — puoi correggere errori grammaticali, non riscrivere la struttura
4. Dopo 24 ore annota: impression, bookmark, reply, repost
5. Scrivi una riga di note — anche "niente di particolare" è un dato

**Cosa guardare:**
- **Bookmark** — segnale più forte: "voglio rileggere questo"
- **Reply** — qualcuno ha qualcosa da dire, positivo anche se critico
- **Impression** — reach algoritmico, utile ma secondario

**Attenzione:** i primi 2-3 thread su account nuovo avranno reach bassa (<50 impression). Non scartare un hook per i primissimi post — aspetta almeno 5-6 prima di trarre conclusioni.

### Criterio di stop anticipato

Se dopo 5 thread: 0 bookmark e 0 reply su tutti e 5:

| Scenario | Causa probabile | Azione |
|---|---|---|
| Impression < 30 su tutti | Account troppo nuovo | Aspetta 5 giorni, riposta il thread migliore |
| Impression OK, 0 bookmark | Hook deboli o topic sbagliato | Porta i 5 hook peggiori a Claude Code — revisione prompt |
| Impression OK, 0 reply | Tono passivo o generico | Cambia categoria (es. coding AI pratico invece di governance) |

### Dopo 15 giorni — analisi pattern

1. Ordina il log per bookmark (non impression)
2. Identifica i 2-3 post con più bookmark — argomento? tipo hook? slide di origine? tono?
3. Compila sezione "Pattern vincenti" in `test-distribuzione.md`
4. Solo dopo → M22

---

## 4. M21b — Carousel Instagram ✅

### Architettura visiva

- **Slide 1**: `article.image` (og:image dal sito sorgente) come sfondo con overlay dark
- **Slide 2-5**: immagini Pexels via `cs.image_query` (portrait, large2x ~1880px)
- **`layout_type`**: controlla crop, posizione e composizione — fisso per posizione
- **`icon`**: SVG inline scelto dall'AI tra: `tag`, `waves`, `heart`, `vibration`, `check`
- **Fallback**: gradiente dark tech per slide senza immagine

| layout_type | Composizione |
|---|---|
| `hero` | immagine destra full-height, overlay gradiente da sinistra |
| `right-focus` | foto destra con bordo sinistro blu |
| `sensor-zoom` | crop centrale 2x, sfumato in basso |
| `human-hand` | foto ancorata in basso a destra |
| `cta-final` | foto con glow blu e bordo accent |

### Struttura JSON target per ogni articolo

```json
{
  "title": "...", "link": "...", "image": "https://...",
  "slides": ["...", "...", "...", "...", "..."],
  "thread_text": ["...", "...", "...", "...", "..."],
  "video_script": ["...", "...", "...", "...", "..."],
  "carousel_slides": [
    { "hook": "...", "description": "...", "visual_hint": "...",
      "layout_type": "hero",        "icon": "tag",       "image_query": "...", "image": "https://..." },
    { "hook": "...", "description": "...", "visual_hint": "...",
      "layout_type": "right-focus", "icon": "waves",     "image_query": "...", "image": "https://..." },
    { "hook": "...", "description": "...", "visual_hint": "...",
      "layout_type": "sensor-zoom", "icon": "heart",     "image_query": "...", "image": "https://..." },
    { "hook": "...", "description": "...", "visual_hint": "...",
      "layout_type": "human-hand",  "icon": "vibration", "image_query": "...", "image": "https://..." },
    { "hook": "...", "description": "...", "visual_hint": "...",
      "layout_type": "cta-final",   "icon": "check",     "image_query": "...", "image": "https://..." }
  ]
}
```

### Implementazione — Step completati

**Step A — `generateCarouselSlides()` in `generate.js`** ✅ (2026-05-08)
Accetta `(title, slides, thread_text)` — i tweet vengono inclusi nel prompt per description più ricche. `icon` scelto dall'AI, `layout_type` fisso per posizione. Validazione + 1 retry poi null.

**Step A.5 — `fetchArticleImage()` per slide 1** ✅ (2026-05-08 + fix 2026-05-11)
Estrae `og:image`/`twitter:image` dalla pagina sorgente, timeout 8s. Inizialmente solo in `backfill-carousel.js`. Fix 2026-05-11: aggiunta a `run.js` (nuovi articoli avevano `image` mancante). Ora condivisa in `fetch.js`.

**Step B — `backfill-carousel.js`** ✅ (2026-05-08)
- Deduplicazione per slug (file più recente per articolo)
- Tre step per articolo: genera `carousel_slides` → fetch Pexels (slide 2-5) → fetch `article.image` (slide 1)
- Flag `--force`: sovrascrive immagini esistenti | Flag `--last N`: limita agli N più recenti
- Rate limit: 18s tra chiamate Pexels | Stima upfront: `Chiamate Pexels: N | Tempo: ~N min`

**Step C — `frontend/carousel.html`** ✅ (2026-05-08)
Preview 270×337px (4:5), dark tech, Inter 900. Badge dinamico da dominio articolo. Handle `@FlashAI`. Dropdown selector articolo.

**Upgrade Pexels** ✅ (2026-05-11) — Wikimedia sostituita con Pexels su slide 2-5. Ultime 20 notizie backfillate: 76/76 Pexels ✅

**Download PNG** ✅ (2026-05-11) — `html2canvas@1.4.1`, scala 4x → resize a 1080×1350px esatti.
- Fix border-radius: `slideEl.style.borderRadius = '0'` prima del capture (angoli trasparenti → bordi colorati su IG)
- Fix dimensioni: canvas finale 1080×1350, draw con offset y:1 (2px differenza causava crop automatico Instagram)
- Bottone "Scarica slide N" + "Scarica tutte e 5" + modal con `<img>` reale per tasto destro / long press

**Step D — Deploy** ✅ | **Step E — Full backfill (58 articoli)** ✅ — 58/58 carousel_slides

---

## 5. Roadmap futura

### FASE 3 — Identificazione pattern (dopo 15 thread M21)

Compilare analisi in `test-distribuzione.md`:
- Hook che fermano: tipo (domanda / numero / contrasto / conseguenza)
- Slide origine più frequente per tweet 1 (slide 1 vince sempre, o 3/5 la supera spesso?)
- Topic migliori: coding AI, agenti, produttività, sostituzione lavoro, costi AI
- Topic deboli: poca interazione, nessun bookmark

### M22 — Iterazione prompt da dati reali ⏳

**Solo dopo M21 completato e analisi pattern pronta.**

**Prompt per Claude Code:**
```
Leggi ./test-distribuzione.md dalla root del progetto e identifica:
- quali hook (slide 1) hanno generato più engagement
- quali pattern ricorrono nei post che hanno funzionato
- quali argomenti o formulazioni sono stati ignorati

Sulla base di questi dati, riscrivi il prompt in generateSlides() in generate.js.
Documenta nel commento in cima alla funzione:
// PROMPT v2 — aggiornato dopo M22
// - [modifica 1 + motivazione basata su dato reale]
// Data: [data]

Dopo la modifica:
- echo "{}" > cache.json
- node run.js
- salva 10 output in test-output-v2/
```

**Test:** confronta `test-output/` (v1) vs `test-output-v2/` (v2). Almeno 8/10 hook v2 percettibilmente più forti. Il commento deve citare dati reali, non intuizioni.

### FASE 5 — Secondo canale (dopo M22) ⏳

`carousel.html` è già pronto con PNG 1080×1350px.
- **Instagram**: scarica 5 PNG da `carousel.html` + caption da `thread_text`; Reel da `video_script`
- **TikTok**: video con TTS, testo in overlay, ritmo rapido da `video_script`

### FASE 6 — Automazione (dopo FASE 5) ⏳

Solo quando soddisfatte: 2-3 pattern hook stabili + canale che converte + formato definitivo.
- `export-carousel.js` con Playwright — `exports/{slug}/slide-N.png` a risoluzione esatta senza dipendere dallo zoom del browser
- Automazione pubblicazione — solo se il flusso manuale è già stabile e ripetibile

### Backlog

| Milestone | Nota |
|---|---|
| M18 — Ranking per qualità | `articles.sort((a,b) => b.score - a.score)` in `run.js` prima di scrivere `data.js`; parità → `pubDate` desc; score assente = 0 |
| M19 — Index globale articoli | `output/index.json`: array `{ slug, title, pubDate, score, processedAt }`, dedup per slug, aggiornato da `run.js` |
| M20 — Branding e URL pulito | `<title>AISnap</title>`, meta description, favicon inline SVG, nome in slide 5 opacity 0.4 |

---

## 6. Riferimento tecnico

### Pipeline completa

```
fetch RSS (AI News ✅, TechCrunch ✅, O'Reilly 404)
 → deduplicate (normalize: lowercase, alfanumerici, prime 5 parole) — Set su titoli normalizzati
 → hardFilter (whitelist: ai/gpt/agent/llm + blacklist: funding/politics/lawsuit) — riduce 70-80%
 → batchAIFilter (batch da 10, useful=true, score >= 7)
 → generateSlides (5 ruoli fissi: HOOK→CONTESTO→SORPRENDENTE→PRATICO→TAKEAWAY, max 8 parole)
 → generateFormats (thread_text[5] + video_script[5], solo se GENERATE_FORMATS=true)
 → generateCarouselSlides (5 carousel_slides con hook/description/layout/icon/image_query)
 → fetchPexelsImage (slide 2-5, portrait, large2x, 18s delay in backfill)
 → fetchArticleImage (og:image/twitter:image per slide 1, timeout 8s)
 → salva output/timestamp_slug.json
 → scrive frontend/data.js (dedup per slug, sort desc per savedAt)
```

### Snippet tecnici chiave

**Deduplicazione fuzzy:**
```js
function normalize(title) {
  return title.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").slice(0, 5).join(" ");
}
```

**Batch AI filter — controllo indici mancanti:**
```js
expectedIndexes.forEach(i => {
  if (!returnedIndexes.includes(i)) console.warn(`Indice mancante: ${i}`);
});
```

**Cache persistente:**
```js
const hash = md5(normalize(title));
if (cache[hash]) return cache[hash];
cache[hash] = result;
fs.writeFileSync('cache.json', JSON.stringify(cache));
```

**Validazione slide:**
```js
function isValid(slides) {
  return slides.length === 5 && slides.every(s => s.split(" ").length <= 8);
}
```

**html2canvas — fix PNG per Instagram:**
```js
async function renderToCanvas(slideEl) {
  const origRadius = slideEl.style.borderRadius;
  slideEl.style.borderRadius = '0'; // angoli trasparenti → bordi colorati su IG senza questo fix
  const raw = await html2canvas(slideEl, { scale: 4, useCORS: true, backgroundColor: '#080c18' });
  slideEl.style.borderRadius = origRadius;
  const final = document.createElement('canvas');
  final.width = 1080; final.height = 1350;
  const ctx = final.getContext('2d');
  ctx.fillStyle = '#080c18';
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.drawImage(raw, 0, 0, raw.width, raw.height, 0, 1, 1080, 1348); // offset y:1 → 2px evitano crop IG
  return final;
}
```

### Ottimizzazione costi

- Passare solo il titolo, mai l'articolo completo
- Batch da 10 titoli per chiamata DeepSeek
- Hard filter prima di qualsiasi chiamata AI
- Cache persistente su file
- Non usare Claude a runtime — DeepSeek per produzione

### Errori comuni

| Errore | Conseguenza | Soluzione |
|---|---|---|
| Claude a runtime | Costo troppo alto | DeepSeek per produzione |
| Nessun hard filter | Costi AI esplodono | Filtrare prima di ogni chiamata |
| Output libero senza struttura | JSON rotto | Formato fisso + validazione |
| Nessuna cache | Paghi lo stesso articolo due volte | md5 su titolo normalizzato |
| Indici batch non verificati | Mappatura silenziosa sbagliata | Controllo indici attesi vs ricevuti |
| Review queue non monitorata | Fallback invisibili | Warning automatico oltre 10 elementi |
| PNG con border-radius | Angoli trasparenti visibili su IG | Azzerare borderRadius prima di html2canvas |
| PNG 1080×1348 invece di ×1350 | Crop automatico Instagram | Canvas finale 1350px, draw con offset y:1 |
| `--last N` con altri flag | '20' incluso nei filtri slug | Escludere `args[lastIdx + 1]` dal FILTER array |

### Scheduling e deploy

```bash
# GitHub Actions (pipeline.yml)
cron: '0 */2 * * *'
env: GENERATE_FORMATS=true

# Railway
npm start → node server.js   # non run.js — server.js è il processo sempre attivo
# Ogni push GitHub Actions → autodeploy Railway (~1 minuto)
# Trigger manuale: GitHub → Actions → Run workflow
```

---

## 7. Milestones completate — storico

### M1–M9 — Infrastruttura base ✅

- **M1**: setup Node.js, dipendenze (axios, rss-parser, dotenv, md5), `.env`, `.gitignore`
- **M2**: `deepseek.js` — `callDeepSeek(prompt)` → `https://api.deepseek.com/v1/chat/completions`, modello `deepseek-chat`
- **M3**: `fetch.js` — `fetchArticles()`, 3 feed RSS, `Promise.allSettled` (un feed che cade non blocca gli altri)
- **M4**: `filter.js` — `normalize`, `deduplicate`, `hardFilter` — pipeline: 32 → 32 → 25
- **M5**: `batchAIFilter` — batch da 10, `useful=true` + `score >= 7` — pipeline: 25 → 16
- **M6**: `generateSlides` — 5 slide, max 8 parole, parse robusto con regex sulla risposta grezza
- **M7**: `validateWithFallback` — 2 tentativi poi `review_queue.json` — warning se >10 elementi
- **M8**: cache `cache.json` — `md5(normalize(title))` come chiave — cache hit = 0 chiamate API
- **M9**: `run.js` — flusso completo, output `timestamp_slug.json`, riepilogo finale a console

### M10–M13 — Frontend e deploy ✅

- **M10**: `frontend/index.html` — scroll-snap `y mandatory`, `100vh` per slide, palette slate monocromatica (#0f172a → #475569)
- **M11**: `run.js` scrive `frontend/data.js` con `window.ARTICLES = [...]`; `index.html` renderizza dinamicamente
- **M12**: `.github/workflows/pipeline.yml` — cron `0 */2 * * *`, commit + push automatico, `DEEPSEEK_API_KEY` come GitHub Secret
- **M13**: deploy Railway — `server.js` HTTP minimale, auto-deploy su push, env var su Railway

### M14 — Riscrittura prompt slide ✅ (2026-05-06)

Prompt `generateSlides()` riscritto con 5 ruoli narrativi fissi:
- Slide 1 = HOOK (domanda/affermazione che crea tensione, non titolo di giornale)
- Slide 2 = CONTESTO (una frase, una info nuova)
- Slide 3 = SORPRENDENTE (cosa il lettore non si aspetta)
- Slide 4 = PRATICO (cosa cambia concretamente)
- Slide 5 = TAKEAWAY (frase finale netta)

2 esempi completi nel prompt (DA NON FARE / DA FARE). "LIMITE ASSOLUTO: conta le parole". Fallback sceso da ~60% a ~8%.

### M16 — Output multi-formato ✅ (2026-05-06)

`generateFormats(title, slides)` separata da `generateSlides()`. Produce `thread_text[5]` (tweet diretti, no hashtag) e `video_script[5]` (linguaggio parlato). Retry 1x se JSON non valido, poi null — l'articolo viene salvato comunque. Controllato da `GENERATE_FORMATS=true`.

### M17 — Pagina di review ✅ (2026-05-06)

`frontend/review.html` — dark theme, "Copia tutto" per articolo (titolo + slide + thread + script negli appunti), `timeAgo()`, articoli con formati mostrati prima di quelli senza. `overflow-wrap: break-word` su tutti i testi.

### Backfill formati ✅ (2026-05-06)

`backfill.js` — 226 JSON, `formatCache` da duplicati, 75 da cache + 11 da API → 44 articoli unici in `data.js`.

### M15 — Frontend UX a due assi ✅ (2026-05-06)

`index.html` riscritto con layout a 3 aree per slide:
- `.slide-visual` (50% h — gradiente colorato + `article.image` come sfondo)
- `.slide-content` (badge "AI NEWS" + titolo uppercase centrato su nero)
- `.slide-info` (dot indicators + icone SVG + caption con `timeAgo`)

`.feed` scroll verticale (cambia notizia) + `.story` scroll orizzontale (cambia slide). `touch-action: pan-x pan-y` su `.story`. `window.visualViewport.height` per `--vh` (fix address bar Chrome Android). `IntersectionObserver` per reset a slide 1 al cambio articolo (threshold 0.6). Edge case: ultima slide + swipe → avanza al prossimo articolo. **7/7 scenari test superati su mobile reale.**

### Bug fix ✅ (2026-05-06)

- **Cross-run dedup**: `run.js` carica slug esistenti da `output/` prima di girare — stesso articolo non scritto 18x
- **GENERATE_FORMATS in CI**: aggiunto a `pipeline.yml` — formati generati automaticamente in CI
- **Ordinamento**: `data.js` sort per `savedAt` decrescente — articoli più recenti prima
- **Data relativa**: `timeAgo()` implementata, `savedAt`/`pubDate` salvati su ogni articolo

### PRE-M21 ✅ (2026-05-07)

- Fix tensione irrisolta (vedi sezione 3)
- **Fix link fonte**: `run.js` salva `link`; `review.html` + `index.html` mostrano "↗ Fonte" (link diretto) o "↗ Cerca" (Google Search)
- **Fix titolo review.html**: `flex-wrap: wrap` + `min-width: 0` su `.article-title` — non va più a capo parola per parola
- `backfill-links.js`: recuperato link RSS per 20/45 articoli; i restanti 25 hanno fallback Google Search
- **45/45 articoli rigenerati** con `regenerate-all.js`, 0 fallimenti

### M21b — Carousel Instagram ✅ (2026-05-08 + upgrade 2026-05-11)

Vedi sezione 4 per tutti i dettagli. Risultato finale: 58/58 articoli con `carousel_slides` ✅, immagini Pexels per slide 2-5 ✅, og:image per slide 1 ✅, download PNG 1080×1350px da `carousel.html` ✅.

Bug risolto durante Step E: `buildDataJs` non ordinava i file prima della deduplicazione per slug — prendeva file casuali invece del più recente, lasciando 37 articoli senza `carousel_slides` in `data.js`. Fix: `.sort().reverse()` su `readdirSync` prima del map.
