# Visual AI Scroll Blog — PROJECT

Documento unificato: stato attuale · roadmap · riferimento tecnico · storico.  
Aggiornato: 2026-05-26 | Fonte di verità tecnica. Documento operativo correlato: **MANUAL.md**  
Docs archiviati in `archive/docs/`: FOOD-AGENT.md · REFACTOR-PLAN.md · CONTEXT.md · LAVORO.md · M21-roadmap.md

---

## 1. Stato attuale

**Data:** 2026-05-27 | **Articoli AI:** 141+ unici | **Articoli Food:** 24+ | **Articoli Fitness:** 28+ | **Pipeline:** automatica ogni 2 ore (GitHub Actions) | **Deploy:** Railway

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
| **Food Agent — 5 Step Food** | ✅ Completa | `fetch-food.js` + `generate-food.js` + `core/run-agent.js food` |
| **Feed multi-agente** | ✅ Completa | `index.html` agent-bar, `renderFeed()`, palette `.food-story`, navigazione tra pagine |
| **Carousel AI News completo** | ✅ Completa | Sezioni Hook/Thread/Caption/Script in `carousel.html`; `generateAINewsCaption` in pipeline; 74 caption backfillate |
| **Refactor FASE 1 — Schema v2** | ✅ Completa | `schema_version`, `agent`, `status`, `prompt_version`, `formats.*`, alias legacy |
| **Refactor FASE 1B — Protezione backfill** | ✅ Completa | `backfill.js`, `regenerate-all.js`, `backfill-carousel.js` skippano file v2 |
| **Refactor FASE 3-4 — Registry + Config agenti** | ✅ Completa | `agents/ai-news/config.js`, `agents/food/config.js`, `agents/fitness/config.js` |
| **Refactor FASE 5-7 — Runner unico** | ✅ Completa | `core/run-agent.js` — orchestra AI news, food, fitness da config dichiarativa |
| **Refactor FASE 8 — Channel adapters** | ✅ Completa | `channels/x.js`, `channels/instagram.js`, `channels/tiktok.js` |
| **Refactor FASE 9 — Agente Fitness** | ✅ Completa | `agents/fitness/` (config + prompts + filters), `output/fitness/`, pipeline CI |
| **Refactor FASE 10 — data-agents.js** | ✅ Completa | `window.AGENTS = {ai-news, food, fitness}`, `scripts/build-data-agents.js`, `index.html` + `review.html` aggiornati |
| **Refactor FASE 11 — Review multi-canale** | ✅ Completa | Schema v2: badge agente, status pill, prompt_version, select canale X/IG/TikTok, sezioni per canale, copia per canale |
| **Refactor FASE 13 — Carousel unificato** | ✅ Completa | `carousel.html?agent=ai-news\|food`, `carousel-food.html` rimosso; proxy immagini in `server.js` |
| **Fix download PNG food** | ✅ Fix | Proxy `/proxy-image` in `server.js` bypassa CORS Giallozafferano; Pexels usa ancora `useCORS` diretto |
| **Workflow approvazione articoli** | ✅ Completa | `POST /api/set-status` in `server.js`; tasto Approva in `review.html` (barra FASE12 progress) e `carousel.html` (status pill + counter + ✅ emoji nel dropdown) |
| M21 — Test distribuzione reale | 🔄 In corso | Primo post 2026-05-11 ore 15:00 IT su X. 1 thread/giorno |
| **Refactor FASE 14 — Video Engine V2** | ✅ Completa (2026-05-20) | Schema v3 migrato. Pipeline slide-deck: zoompan + TTS OpenAI 44kHz + subtitle. `render-pending.js` auto-import PNG + auto build+push. CI genera piani ogni 2h. Video visibili su Railway. |
| **Refactor FASE 15 — Visual Template Engine** | ✅ Completa (2026-05-22) | Motore template modulare: ogni agente dichiara i template disponibili. `kinetic_typography` operativo (FFmpeg drawtext + TTS). `render_status` migrato da quality-key a template-key. `window.AGENT_CONFIGS` nel frontend. Dropdown **Video Template** in `carousel.html`. |
| **FASE 16A — data_story** | ✅ Completa | bar/line/comparison/counter, SVG frames + FFmpeg |
| **FASE 16B — timeline_motion** | ✅ Completa | eventi reveal top→down, SVG + FFmpeg |
| **FASE 16C — network_graph** | ✅ Completa | nodi/edge animati opacity reveal, SVG + FFmpeg |
| **FASE 16D — minimal_documentary** | ✅ Completa | Pexels images + Ken Burns + vignette + TTS |
| **FASE 16E — code_terminal** | ✅ Completa | typing animation SVG + syntax highlight + cursor blink |
| **FASE 16F — whiteboard** | ✅ Completa | stroke-dashoffset animation + arrowhead smart connector |
| **FASE 16G — isometric_workflow** | ✅ Completa | SVG 3D-illusion + ImageMagick + FFmpeg, reveal progressivo |
| **FASE 16H — map_explainer** | ✅ Completa | GeoJSON Natural Earth + Mercatore + viewBox zoom regioni |
| **FASE 16I — parallax_25d** | ✅ Completa | FFmpeg crop offset dinamico, immagini Pexels |
| **FASE 16J — simulation_lab** | ✅ Completa | particle simulation Node.js, 5 tipi di fisica |
| **FASE 16K — wireframe_3d** | ✅ Completa | perspective projection Node.js, 6 shape, neon glow |
| **FASE 16L — anatomy_motion** | ✅ Completa (2026-05-26) | Blender EEVEE headless + BodyParts3D (54 OBJ, CC BY 4.0) + emissive glow + TTS. `defaultVideoTemplate` fitness. Video squat explainer funzionante. |
| **Separazione render video** | ✅ Completa (2026-05-27) | Render 100% locale, non tracciato in git. `review.html`: riga video-plan con badge template + "⬇ Esporta piano" (client-side JSON download). Template Cat 3 (Blender) rimangono solo locali. |
| **Fix generate-video-plan** | ✅ Completa (2026-05-27) | Rimosso filtro `render_quality` — genera piani per tutti gli `approved` automaticamente. `render_quality` default `'low'` se mancante. Backfill esistenti al prossimo run CI. |
| **FASE 16M — product_xray** | 📋 Da implementare | — |
| **FASE 16N — lowpoly_3d** | 📋 Da implementare | — |
| **Refactor FASE 12 — Automazione publish** | 🔒 Bloccata | Instagram: account ristretto da Meta (impossibile creare App developer). TikTok sandbox ✅. X API Free non permette POST. |
| M22 — Iterazione prompt da dati | ⏳ Dopo M21 | Richiede 15 post con dati reali |
| FASE 5 — Secondo canale | ⏳ Dopo sblocco Instagram | Instagram: carousel PNG già pronti per tutti gli agenti |
| FASE 6 — Automazione pubblicazione | ⏳ Dopo FASE 5 | Auto-pubblicazione via scheduler.js |
| M18 — Ranking per qualità | ⏳ Backlog | Nice to have |
| M19 — Index globale articoli | ⏳ Backlog | Utile quando il volume cresce |
| M20 — Branding e URL pulito | ⏳ Backlog | - |

**Ordine di esecuzione:**
```
M1-M13 ✅ → M14 ✅ → M16 ✅ → M17 ✅ → Backfill ✅ → M15 ✅ → PRE-M21 ✅ → M21b ✅
→ Pexels ✅ → Download PNG ✅ → Food Agent ✅ → Feed multi-agente ✅
→ Refactor FASE 1-13 ✅ (schema v2, runner unico, fitness, carousel unificato, review v2)
→ FASE 14 ✅ (video engine V2, slide-deck, TTS, render-pending auto-push)
→ FASE 15 ✅ (visual template engine, kinetic_typography, dropdown Video Template)
→ M21 🔄 ← STOP: valuta risultati (15 post, iniziato 2026-05-11)
→ FASE 12 🔒 (bloccata Instagram) → M22 → FASE 5 → FASE 6 → M18 → M19 → M20
```

---

## 2. Progetto

**Cos'è:** sistema automatico che recupera articoli da feed RSS ogni 2 ore — notizie AI e ricette food — genera 5 slide + thread X + script video per ciascuno, e li mostra come feed scrollabile stile Instagram Stories su Railway. Due agenti indipendenti (AI News e 5 Step Food) con pipeline, dati e palette visiva separati.

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

**Agente AI News**

| File | Ruolo |
|---|---|
| `run.js` | Entry point AI news — orchestra pipeline, dedup cross-run, scrive `frontend/data.js` |
| `fetch.js` | RSS feed AI + `fetchPexelsImage(query)` + `fetchArticleImage(url)` |
| `filter.js` | `deduplicate`, `hardFilter`, `batchAIFilter` |
| `generate.js` | `generateSlides` + `generateFormats` + `generateCarouselSlides` + `generateAINewsCaption` — con cache |
| `validate.js` | `isValid`, `validateWithFallback` → `review_queue.json` |
| `backfill.js` | Backfill `thread_text`/`video_script`/`instagram_caption` su articoli esistenti |
| `backfill-carousel.js` | Backfill `carousel_slides` + Pexels + `article.image` — flag `--force`, `--last N` |
| `regenerate-all.js` | Rigenera slide + formati per tutti gli articoli unici con prompt aggiornati |
| `output/` | JSON AI news generati (`timestamp_slug.json`) |
| `frontend/data.js` | Generato da `run.js` localmente — non usato dal frontend (usa `data-agents.js`) |

**Agente 5 Step Food**

| File | Ruolo |
|---|---|
| `fetch-food.js` | Feed RSS food (Giallozafferano) + `fetchArticleContent(url)` per scraping ingredienti |
| `generate-food.js` | `generateRecipeSlides` + `generateRecipeCarouselSlides` + caption/video/thread food |
| `output/food/` | JSON food generati, separati da `output/` |
| `frontend/data-food.js` | Generato da `core/run-agent.js food` — non usato dal frontend (usa `data-agents.js`) |

**Frontend condiviso**

| File | Ruolo |
|---|---|
| `frontend/index.html` | Feed mobile multi-agente: agent-bar, `renderFeed()`, palette `.food-story` |
| `frontend/review.html` | Review multi-agente: header sticky con agent switch, `renderReview()`; tasto **Approva** per impostare `status: approved` + barra progresso FASE12 (0/30) |
| `frontend/carousel.html` | Carousel unificato (`?agent=ai-news\|food`) — preview + download PNG 1080×1350px; sezioni Hook/Thread/Caption/Script; link ↗ Fonte; proxy `/proxy-image` per download food; **status pill + tasto Approva** nella barra DL; contatore approvati nel selector bar; ✅ emoji nel dropdown per articoli approvati |

**Multi-agente (Refactor FASE 1-13)**

| File | Ruolo |
|---|---|
| `core/run-agent.js` | Runner unico — orchestra qualsiasi agente da config dichiarativa (`agents/<id>/config.js`) |
| `agents/ai-news/config.js` | Config agente AI News: feeds, filtri, prompt, output dir, formato cache |
| `agents/food/config.js` | Config agente Food: feeds, gate looksLikeRecipe, output dir |
| `agents/fitness/config.js` | Config agente Fitness: feeds, filtri, output dir |
| `channels/x.js` | Adapter canale X/Twitter — formatta `thread_text` per post |
| `channels/instagram.js` | Adapter canale Instagram — formatta caption + carousel |
| `channels/tiktok.js` | Adapter canale TikTok — formatta `video_script` |
| `scripts/build-data-agents.js` | Legge `output/`, `output/food/`, `output/fitness/` → scrive `frontend/data-agents.js` |
| `frontend/data-agents.js` | Generato — `window.AGENTS = {'ai-news':[...], 'food':[...], 'fitness':[...]}` |

**Infrastruttura**

| File | Ruolo |
|---|---|
| `server.js` | HTTP server minimale — serve `frontend/` su Railway; proxy `/proxy-image` per immagini CORS-incompatibili (food); `POST /api/set-status` per impostare `status` su un articolo da review/carousel |
| `deepseek.js` | Wrapper `callDeepSeek(prompt)` → stringa risposta |
| `cache.json` | Cache persistente condivisa — chiavi per agente (`md5(title)`, `ainews:caption:*`, `food:*`) |
| `review_queue.json` | Articoli AI news falliti dopo 2 tentativi di validazione |
| `.github/workflows/pipeline.yml` | GitHub Actions — cron `0 */2 * * *`; esegue `core/run-agent.js ai-news`, `core/run-agent.js food`, `core/run-agent.js fitness`, poi `build-data-agents.js` e piani video |
| `.railwayignore` | Esclude `output/`, `output/food/`, `output/fitness/` dal deploy Railway |
| `test-distribuzione.md` | Log giornaliero dei post M21 su X |
| `MANUAL.md` | Manuale operativo: come eseguire tutte le operazioni (30 sezioni) |

### Flusso autonomo

```
ogni 2 ore
  └── GitHub Actions esegue core/run-agent.js ai-news
        └── agents/ai-news/config.js → fetch RSS → hardFilter → batchAIFilter
              └── generateSlides + generateFormats + generateAINewsCaption + generateCarouselSlides
                    └── fetchPexelsImage (slide 2-5) + fetchArticleImage (slide 1)
                          └── salva output/*.json
  └── GitHub Actions esegue core/run-agent.js food
        └── agents/food/config.js → fetch Giallozafferano → looksLikeRecipe gate
              └── generateRecipeSlides + carousel + caption + videoScript + thread
                    └── salva output/food/*.json
  └── GitHub Actions esegue core/run-agent.js fitness
        └── agents/fitness/config.js → fetch → gate → generate → salva output/fitness/*.json
  └── GitHub Actions esegue scripts/build-data-agents.js
        └── legge output/ + output/food/ + output/fitness/ → scrive frontend/data-agents.js
              └── window.AGENTS = {'ai-news':[...], 'food':[...], 'fitness':[...]}
  └── GitHub Actions genera piani video (ai-news, food, fitness) via video/generate-video-plan.js --ci
  └── git commit + push
        └── Railway autodeploy (~1 min)
              └── sito aggiornato online (tutti gli agenti via data-agents.js)
```

### Note operative

- **Feed O'Reilly** restituisce 404 — ignorato automaticamente
- **DeepSeek cost**: pochi centesimi per run; la cache azzera il costo sugli articoli già visti
- **GitHub Actions**: gratuito fino a 2000 min/mese — il progetto ne usa ~30/mese (AI news + food sequenziali)
- **Pexels API**: free tier, 200 req/ora, 20.000/mese — sufficiente (AI news 4-8 articoli + food 3 articoli/run)
- **Tutti gli agent runners usano `cache.json`** — NON parallelizzare gli step che scrivono su `cache.json`, causerebbe write conflict silenzioso
- **Food gate looksLikeRecipe**: evita chiamate API su contenuti non ricetta — azzerato il costo su articoli magazine nel feed
- **Backfill selettivo AI news**: `node backfill-carousel.js --force --last N` per aggiornare gli N più recenti
- **Token GitHub**: serve scope `workflow` per pushare `.github/workflows/`
- **Railway deploy**: ~1 minuto grazie a `.railwayignore` che esclude `output/`, `output/food/` e `output/fitness/`
- **Nota crescita**: quando `data-agents.js` pesa sul browser, aggiungere `.slice(-50)` per agente in `build-data-agents.js` prima di scrivere il file
- **Proxy immagini food**: `server.js` espone `/proxy-image?url=...` — necessario localmente per scaricare PNG food (Giallozafferano non ha CORS headers). In produzione Railway lo serve automaticamente.
- **Workflow approvazione (locale)**: approvare articoli da `review.html` o `carousel.html` → scrive `status: "approved"` nel JSON locale → committare i JSON modificati → push → Railway rideploya con gli status aggiornati. L'approvazione su Railway è effimera (si perde al prossimo redeploy) — il flusso corretto è sempre locale → commit → push.

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

### Riferimento visivo

**Prima di modificare `carousel.html`**, aprire questa immagine — è il carousel del Fitbit Air già generato dal sistema. Mostra badge, gerarchia testi, posizione immagine, palette e footer. È la fonte di verità per il layout: replicare quella struttura, non inventarne una nuova.

```
/home/miki/visual-scroll-blog/template carousel.png
# oppure da Windows: \\wsl$\Ubuntu\home\miki\visual-scroll-blog\template carousel.png
```

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
  "instagram_caption": "...",
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

Entrambi i carousel sono già pronti con PNG 1080×1350px.
- **Instagram AI News**: 5 PNG da `carousel.html` + caption da `thread_text`; Reel da `video_script`
- **Instagram Food**: 5 PNG da `carousel.html?agent=food` + `instagram_caption` già generata da `generate-food.js`
- **TikTok**: video con TTS, testo in overlay, ritmo rapido da `video_script` o `video_script` food

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
 → generateAINewsCaption (instagram_caption — tono educativo/diretto, fatti concreti, cache ainews:caption:*)
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

**html2canvas — fix PNG per Instagram (con proxy immagini non-CORS):**
```js
// Pexels ha CORS headers — useCORS li gestisce direttamente; proxy solo per sorgenti senza CORS (es. Giallozafferano)
async function proxyBlobUrl(imgUrl) {
  if (imgUrl.includes('images.pexels.com')) return null;
  try {
    const resp = await fetch('/proxy-image?url=' + encodeURIComponent(imgUrl));
    if (!resp.ok) throw new Error('proxy ' + resp.status);
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = resolve;
      img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(); };
      img.src = blobUrl;
    });
    return blobUrl;
  } catch { return null; }
}

async function renderToCanvas(slideEl) {
  const origBg = slideEl.style.backgroundImage;
  let blobUrl  = null;
  if (origBg && origBg !== 'none') {
    const m = origBg.match(/url\(["']?([^"')]+)["']?\)/);
    if (m) {
      blobUrl = await proxyBlobUrl(m[1]);
      if (blobUrl) {
        slideEl.style.backgroundImage = `url('${blobUrl}')`;
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); // attendi repaint
      }
    }
  }
  const origRadius = slideEl.style.borderRadius;
  slideEl.style.borderRadius = '0'; // angoli trasparenti → bordi colorati su IG senza questo fix
  const raw = await html2canvas(slideEl, { scale: 4, useCORS: true, allowTaint: false,
    backgroundColor: theme.canvasBg, logging: false, imageTimeout: 15000 });
  slideEl.style.borderRadius = origRadius;
  if (blobUrl) { URL.revokeObjectURL(blobUrl); slideEl.style.backgroundImage = origBg; }
  const final = document.createElement('canvas');
  final.width = 1080; final.height = 1350;
  const ctx = final.getContext('2d');
  ctx.fillStyle = theme.canvasBg;
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
| PNG food con gradiente invece di foto | GialloZafferano non ha CORS headers — html2canvas non legge i pixel | Proxy `/proxy-image` in `server.js` — richiede `node server.js` in locale |
| Flash gradiente verde su download food | `fetch` con CORS fallisce → sfondo rimosso → html2canvas cattura il fallback | Usare il proxy blob URL + doppio `requestAnimationFrame` prima di html2canvas |

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

### Test di regressione M15 — UX mobile a due assi

Eseguire su telefono reale (iPhone Safari + Android Chrome) ogni volta che si modifica `index.html`.

| # | Scenario | Atteso |
|---|---|---|
| 1 | Swipe sinistra sulla slide 1 | Va a slide 2, snap fluido, nessun jitter |
| 2 | Avanza a slide 4 → swipe verticale giù | Nuovo articolo parte da slide 1, non dalla 4 |
| 3 | Dalla slide 3, swipe destra → poi swipe su | Torna a slide 2; poi torna all'articolo precedente |
| 4 | Swipe diagonale a 45° | Sceglie un asse entro i primi 10px e non cambia idea per tutta la gesture |
| 5 | Swipe veloce e brevissimo verso sinistra | Lo snap viene comunque triggerato — non rimane a metà |
| 6 | Sulla slide 5, swipe sinistra | Passa all'articolo successivo — non si blocca |
| 7 | Scorri tutte e 5 le slide osservando i dot in cima | Il segmento attivo si aggiorna preciso a ogni slide, senza lag |

Se uno scenario fallisce: descrivere esattamente cosa è successo e su quale device prima di procedere.

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

### Food Agent — 5 Step Food ✅ (2026-05-12)

**STEP 1–3 — Pipeline food** (`fetch-food.js`, `generate-food.js`, `run-food.js`):
- Feed Giallozafferano con WHITELIST food e gate `looksLikeRecipe` (evita articoli magazine)
- `fetchArticleContent` con scraping HTTP: User-Agent + Accept-Language, strip HTML, slice 12000 char
- 5 tipi di generazione per articolo: slides ricetta, carousel_slides, instagram_caption, video_script, thread_text
- Cache prefissata `food:*` condivisa con `cache.json` AI news — nessuna collisione
- `dish_type` (pasta/meat/fish/soup/dessert/salad/vegetable/generic) e `signature_ingredients` a root
- Fix "savory" qualifier: image_query antepone "savory" per dish_type non dessert (evita foto dolci da Pexels)
- og:image slide 1 con filtro URL generici (logo/placeholder/default/avatar), fallback Pexels

**STEP 4 — `carousel-food.html`**:
- Palette food: olive #3d5a3e, arancio caldo #e07b39, crema #f7efe3, dark #10150f
- Gradienti per layout (hero/right-focus/sensor-zoom/human-hand/cta-final) con radiali olive/arancio
- SVG decorativi food per slide (cerchio piatto, dots spezie, linee impasto, onde calore, glow)
- `signature_ingredients` riga arancio tra hook e description nella hero slide
- Sezioni extra sotto le slide: hook titoli, thread X, caption Instagram (con copia), script video
- Download PNG 1080×1350px identico a `carousel.html`

**STEP 5 — CI GitHub Actions**: `run-food.js` sequenziale dopo `run.js`, non-bloccante (`|| echo`), `MAX_NEW_FOOD_ARTICLES=3`. Gate 10 articoli corretti superato il 2026-05-12.

**STEP 6 — Feed multi-agente** (`index.html`):
- `#agent-bar` fixed top 36px: select ⚡ AI News / 🍳 5 Step Food + nav links Review / Carousel
- `setSizes()` sottrae 36px da `--vh` — snap verticale corretto senza modificare story/slide
- `renderFeed(articles)`: estrae il rendering in funzione richiamabile, disconnette IntersectionObserver al re-render
- Caricamento dinamico `data-food.js` via `<script>` injection al primo switch (no double fetch)

**STEP 7 — Navigazione multi-pagina**: nav links e agent switch su `review.html`, `carousel.html`, `carousel-food.html`. `review.html` refactorizzata con `renderReview(articles)` e header sticky con switch in-page. Carousel pages usano navigazione (design diversi non condivisibili in-page).

**STEP 8 — Palette food nel feed**: classe `.food-story` su ogni story food; gradienti per-layout food (olive/arancio) sovrascrivono il blu AI news; badge #3d5a3e, dot #e07b39, cf-accent #f2b36d, @FlashKitchen.

### Carousel AI News completo ✅ (2026-05-12)

`carousel.html` allineato a `carousel-food.html` — stesse 4 sezioni informative sotto le slide:

| Sezione | Colore # | Fonte dati |
|---|---|---|
| Hook Titoli Slide | `#3B82F6` blu | `carousel_slides[i].hook` |
| Thread X | `#3B82F6` blu | `article.thread_text` |
| Caption Instagram | blu, tasto Copia | `article.instagram_caption` |
| Script Video (Reel / TikTok) | `#7c3aed` viola | `article.video_script` |

Link "↗ Fonte" allineato a destra nella barra "Scarica tutte e 5" — appare solo se `article.link` è presente.

**`generateAINewsCaption(title, slides, thread_text)`** aggiunta a `generate.js`:
- Prompt autonomo (non derivato dal food) — tono educativo/diretto coerente con il brand AI News
- Prima riga: fatto concreto parlato; corpo: contesto semplificato + impatto reale; chiusura: domanda o fatto netto
- Anti-pattern espliciti: nessuna frase editoriale generica ("Il futuro è già qui"), nessun aggettivo vuoto
- Cache separata `ainews:caption:*` — nessuna collisione con thread/carousel/food
- Chiamata in `run.js` dopo `generateFormats`, prima di `generateCarouselSlides`
- `backfill.js` aggiornato: secondo loop backfilla `instagram_caption` per articoli con `thread_text` ma senza caption
- **74 caption generate con 0 fallimenti** su tutti gli articoli esistenti

### FASE 16 — Visual Template Engine (completa per A–L) ✅ (2026-05-22 → 2026-05-26)

**Obiettivo:** sostituire il template unico `slide_deck` con un catalogo di 14 template video specifici per argomento, ognuno con una propria pipeline di rendering (SVG, FFmpeg, ImageMagick, Blender).

#### Architettura comune

Ogni template esporta `{ id, label, requiresCarouselPng, generatePlanPrompt, render }`.  
Il piano video (5 scene) viene generato da `video/generate-video-plan.js` via GPT-4o-mini con il prompt del template.  
Il test locale avviene con `node video/test-template.js --template <id>` — nessun articolo reale, nessuna API AI.

| File | Ruolo |
|---|---|
| `video/templates/index.js` | Registry: mappa id→modulo per tutti i template |
| `video/test-template.js` | Test locale: FAKE_ARTICLES + FAKE_SCENES per ogni template |
| `video/generate-video-plan.js` | Genera piano (5 scene) via GPT-4o-mini usando `generatePlanPrompt` del template |
| `video/assets/blender/anatomy/` | Asset Blender per `anatomy_motion` |

#### Catalogo template

| Template | Label UI | Categoria | Agenti | Tecnica |
|---|---|---|---|---|
| `slide_deck` | Slideshow | 0 | ai-news, food, fitness | zoompan PNG + TTS. Richiede PNG carousel (💾 Salva per video). |
| `kinetic_typography` | Kinetic Text | 1 | ai-news | FFmpeg drawtext animato + TTS |
| `data_story` | Data Story | 1 | ai-news | SVG bar/line/comparison/counter, FFmpeg lavfi |
| `timeline_motion` | Timeline | 1 | ai-news | SVG eventi reveal top→down, FFmpeg |
| `network_graph` | Network Graph | 1 | ai-news | SVG nodi/edge opacity reveal, FFmpeg |
| `minimal_documentary` | Documentary | 1 | ai-news, food, fitness | Pexels images + Ken Burns + vignette + TTS |
| `code_terminal` | Terminal | 1 | ai-news | SVG typing + syntax highlight + cursor blink, FFmpeg |
| `whiteboard` | Whiteboard | 1 | ai-news, food, fitness | SVG stroke-dashoffset + arrowhead smart connector |
| `isometric_workflow` | Isometric | 2 | ai-news | SVG 3D-illusion blocchi, ImageMagick SVG→PNG, FFmpeg |
| `map_explainer` | Map | 2 | ai-news | GeoJSON Natural Earth + proiezione Mercatore, paesi colorati, route animate |
| `parallax_25d` | Parallax | 2 | ai-news, food, fitness | FFmpeg crop offset dinamico, immagini Pexels |
| `simulation_lab` | Simulation | 2 | ai-news, fitness | Particle simulation Node.js, 5 tipi, SVG frames + FFmpeg |
| `wireframe_3d` | Wireframe 3D | 2 | ai-news | Perspective projection Node.js, 6 shape, depth sort + neon glow |
| `anatomy_motion` | Anatomy | 3 | fitness | Blender headless + TTS + FFmpeg. Stile glow emissivo su sfondo nero. |
| `exercise_motion_anatomy` | Exercise Anatomy | 3 | fitness | Corpo intero FJ2810 + Mixamo armature + squat pose bones + skin deformation. `defaultVideoTemplate` fitness. **⚠️ Qualità visiva da rivedere.** |

**Categoria 1** usa SVG frame-per-frame (SVG_FPS=5–10, poi `-framerate SVG_FPS -r 25`).  
**Categoria 2** usa ImageMagick SVG→PNG per qualità grafica superiore.  
**Categoria 3** usa Blender EEVEE headless.

#### FASE 16L — anatomy_motion (dettaglio tecnico)

**Asset in `video/assets/blender/anatomy/`:**

| File | Ruolo |
|---|---|
| `skeleton_full.blend` | 54 mesh muscoli + `body_skin` (FJ2810) da BodyParts3D (IS-A tree), 10 collezioni `grp_*`, EEVEE samples=16, bloom, sfondo nero. **26 MB.** |
| `setup_anatomy_blend.py` | Script eseguito una volta per ricostruire il .blend da `isa_BP3D_4.0_obj_99.zip`. |
| `render_scene.py` | Chiamato da Node.js: mostra collezioni `grp_*` per i body_parts richiesti, applica materiale emissivo con keyframe, usa camera nominata, renderizza in `/tmp/anatomy_frames/`. |

**ZIP sorgenti (non in git — in Downloads):**
- `isa_BP3D_4.0_obj_99.zip` (136 MB) — IS-A tree, 2234 OBJ totali — include **tutto** il corpo (muscoli, ossa, pelle, organi), non solo i muscoli fitness
- `partof_BP3D_4.0_obj_99.zip` (62 MB) — PART-OF tree, 1258 OBJ

**Contenuto chiave del ZIP `isa_BP3D_4.0_obj_99.zip` (verificato 2026-05-26):**

| FJ ID | Struttura | Dimensione | Bounds |
|---|---|---|---|
| `FJ2810` | **Skin completo del corpo umano** — mesh manifold chiusa, 102k vertici, 203k facce | 14 MB | Z: -78 → 1641 mm (corpo intero, piedi→testa, 1.72 m) |
| `FJ3131` | Testa/cranio | 4.7 MB | Z: 986 → 1193 mm |
| `FJ3396` | Torace | 4.5 MB | Z: 820 → 1031 mm |

**FJ2810 = body skin completo** → usato come base per `exercise_motion_anatomy`. Uploadato su **Mixamo** (auto-rig) → FBX scaricato come `FJ2810_body.fbx`.

**Licenza:** BodyParts3D © Life Science Integrated Database Center, CC BY 4.0 — citare nella descrizione video.

**Correzione coordinate (problema risolto 2026-05-26):**  
`wm.obj_import` (default, Blender 4.0.2) applica `R_x(-90°)` ai vertex data + `R_x(+90°)` all'oggetto → net world-space = coordinate OBJ grezze (Y = asse anatomico, mm).  
Fix in `setup_anatomy_blend.py`: `mesh.transform(Scale(0.001))` + `obj.rotation_euler = (0,0,0)` → world Z = altezza anatomica in metri.

**Body bounds dopo fix + floor-align su body_skin (aggiornati 2026-05-26):**

Floor-align ora usa `body_skin` (FJ2810) come riferimento → piede a Z=0.05 m, testa a Z=1.77 m, center Z=0.91 m.

| Gruppo | Z min | Z max |
|---|---|---|
| `body_skin` | 0.050 m | 1.769 m |
| calves | 0.161 m | 0.560 m |
| hamstrings | 0.411 m | 0.893 m |
| quadriceps | 0.443 m | 0.999 m |
| glutes | 0.796 m | 1.079 m |
| biceps | ~1.12 m | ~1.47 m |
| triceps | ~1.16 m | ~1.43 m |
| pecs | ~1.24 m | ~1.46 m |
| shoulders | ~1.33 m | ~1.48 m |
| trapezius | 1.182 m | 1.634 m |

**Velocità render:** ~5 s/frame con samples=8, render_fps=5 → 25 frame/scena → ~125 s/scena. Timeout anatomy-motion.js = 900 s (15 min).

**Blender 4.0.2** installato in WSL via `sudo apt-get install blender`, path `/usr/bin/blender`. Funziona headless senza Xvfb (`--background`). Override path con env var `BLENDER_PATH`.

#### exercise_motion_anatomy — stato (2026-05-26)

**Asset:**
| File | Ruolo |
|---|---|
| `skeleton_full.blend` | 54 muscle OBJ + body_skin FJ2810 (da ZIP) + Mixamo armature (da FBX). Ricostruito 2026-05-26. |
| `setup_anatomy_blend.py` | Ricostruisce .blend: importa muscle OBJ + FBX Mixamo, assegna bone weights ai muscoli (rigid, 1 bone/mesh), floor-align. |
| `render_exercise_motion.py` | Animazione squat via pose bones Mixamo (Hips, LeftUpLeg/RightUpLeg, LeftLeg/RightLeg, LeftFoot/RightFoot). Skin deforma via vertex weights. |
| `FJ2810_body.fbx` | FJ2810 riggato da Mixamo. Path: `C:\Users\halom\OneDrive\Desktop\`. **Non in git.** |

**Dipendenze runtime:**
- numpy installato in `~/.local/lib/python3.12/site-packages/` (via wheel, no sudo) — per FBX importer Blender
- `exercise-motion-anatomy.js` e `anatomy-motion.js` passano `PYTHONPATH` a spawnSync

**Per ricostruire skeleton_full.blend:**
```bash
PYTHONPATH=~/.local/lib/python3.12/site-packages \
  blender --background --python video/assets/blender/anatomy/setup_anatomy_blend.py
```

**⚠️ Da rivedere:** qualità visiva del render (squat frame, posizionamento camera, valori rotazione bones in SQUAT_KEYFRAMES).

**FASE 16M–16N** (product_xray, lowpoly_3d) — non ancora implementate.

---

### Separazione render video ✅ (2026-05-27)

**Obiettivo:** rendere il render video completamente locale e separato dalla pipeline CI/Railway.

**Cosa è cambiato:**
- I template Blender (Cat 3) e i file di test video **non vengono più committati in git** — rimangono solo in locale WSL
- `review.html` ora mostra una riga video-plan sotto ogni articolo: badge template, badge scene count, bottone **"⬇ Esporta piano"**
- Il bottone scarica `video-plan-<slug>.json` (client-side, vanilla JS, no server) pronto per essere passato al render tool locale
- Il render MP4 avviene completamente in locale e non viene pushato su Railway

**JSON esportato da "⬇ Esporta piano":**
```json
{ "slug": "...", "agent": "fitness", "title": "...", "template": "exercise_motion_anatomy", "quality": "low", "scenes": [...] }
```

**Architettura risultante:**
```
GitHub Actions → genera scenes → commit JSON
Railway        → serve frontend + API (nessun render)
WSL locale     → render-pending.js / tool esterno → MP4
review.html    → ⬇ Esporta piano → video-plan.json → tool esterno
```

---

### Fix generate-video-plan: piano automatico per tutti gli approvati ✅ (2026-05-27)

**Problema:** `generate-video-plan.js` richiedeva `render_quality != null` come gate.
Fitness e food avevano 0 articoli con quality impostata → 0 piani mai generati nonostante 27/17 articoli approvati.

**Fix:** rimosso il filtro `render_quality`. Nuova logica:
```
candidato valido = status approved/published  AND  scenes = []
```
`render_quality` viene auto-impostato a `'low'` se mancante (non blocca più).
`render_template` viene auto-impostato dal `defaultVideoTemplate` dell'agente se mancante.

**Backfill automatico:** al prossimo run CI (ogni 2h) vengono generati i piani
per tutti gli articoli approvati che non li hanno ancora. Non serve intervento manuale.
