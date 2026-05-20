# Manuale operativo — Visual AI Scroll Blog

Questo documento spiega come modificare il sistema, con esempi pratici.
Non è necessario capire tutto il codice: ogni sezione indica esattamente quale file aprire e cosa cambiare.

---

## Indice

1. [Come aggiungere una nuova fonte di notizie](#1-aggiungere-una-nuova-fonte-di-notizie)
2. [Come cambiare i filtri sulle parole chiave](#2-cambiare-i-filtri-sulle-parole-chiave)
3. [Come modificare il criterio di qualità AI](#3-modificare-il-criterio-di-qualità-ai)
4. [Come cambiare il numero di slide o le parole per slide](#4-cambiare-il-numero-di-slide-o-le-parole-per-slide)
5. [Come cambiare i colori del frontend](#5-cambiare-i-colori-del-frontend)
6. [Come aggiornare i contenuti manualmente](#6-aggiornare-i-contenuti-manualmente)
7. [Come leggere i log per capire cosa è successo](#7-leggere-i-log)
8. [Come svuotare la cache](#8-svuotare-la-cache)
9. [Come funziona l'automazione GitHub Actions](#9-come-funziona-lautomazione-github-actions)
10. [Come usare la pagina di review](#10-come-usare-la-pagina-di-review)
11. [Come fare il backfill dei formati su articoli esistenti](#11-come-fare-il-backfill-dei-formati)
12. [Come funziona il layout a due assi](#12-come-funziona-il-layout-a-due-assi)
13. [Come rigenerare tutti gli articoli dopo un cambio di prompt](#13-come-rigenerare-tutti-gli-articoli-dopo-un-cambio-di-prompt)
14. [Come fare il backfill carousel e immagini](#14-come-fare-il-backfill-carousel-e-immagini)
15. [Come scaricare le slide carousel come PNG per Instagram](#15-come-scaricare-le-slide-carousel-come-png-per-instagram)
16. [Come funziona la generazione dei contenuti](#16-come-funziona-la-generazione-dei-contenuti) (16.1 slide · 16.2 thread/script · 16.3 caption AI News · 16.5 carousel · 16.6 debug)
17. [Variabili d'ambiente — lista completa e dove configurarle](#17-variabili-dambiente--lista-completa-e-dove-configurarle)
18. [Checklist debug — quando qualcosa non funziona](#18-checklist-debug--quando-qualcosa-non-funziona)
19. [Come gestire review_queue.json e rimuovere un articolo](#19-come-gestire-review_queuejson-e-rimuovere-un-articolo)
20. [Come usare il feed multi-agente (AI News / Food / Fitness)](#20-come-usare-il-feed-multi-agente)
21. [Come eseguire e configurare la pipeline food](#21-come-eseguire-e-configurare-la-pipeline-food)
22. [Come scaricare i carousel food come PNG per Instagram](#22-come-scaricare-i-carousel-food-come-png) → vedi §15
23. [Come approvare articoli per FASE 12](#23-come-approvare-articoli-per-fase-12)
24. [Come generare video (render-video.js)](#24-come-generare-video)
25. [Come pubblicare su TikTok](#25-come-pubblicare-su-tiktok)
30. [Come generare video V2 (pipeline slide-deck)](#30-come-generare-video-v2)
26. [Come pubblicare su Instagram](#26-come-pubblicare-su-instagram)
27. [Come pubblicare su X (Twitter)](#27-come-pubblicare-su-x-twitter)
28. [Come usare lo scheduler (tutti i canali)](#28-come-usare-lo-scheduler)
29. [Come rinnovare il token TikTok](#29-come-rinnovare-il-token-tiktok)
30. [Come generare video V2 (pipeline slide-deck)](#30-come-generare-video-v2)

---

## 1. Aggiungere una nuova fonte di notizie

**File da modificare:** `fetch.js`

Cerca questa sezione nel file:

```js
const FEEDS = [
  'https://feeds.feedburner.com/oreilly/radar',
  'https://www.artificialintelligence-news.com/feed/',
  'https://techcrunch.com/feed/',
];
```

Aggiungi l'URL del nuovo feed RSS in fondo all'array, prima della `]`.

**Esempio — aggiungere il feed di The Verge:**

```js
const FEEDS = [
  'https://feeds.feedburner.com/oreilly/radar',
  'https://www.artificialintelligence-news.com/feed/',
  'https://techcrunch.com/feed/',
  'https://www.theverge.com/rss/index.xml',
];
```

> **Come trovare l'URL RSS di un sito:** cerca su Google `"nome sito" RSS feed`, oppure prova ad aggiungere `/feed/` o `/rss/` alla fine dell'URL principale del sito.

---

## 2. Cambiare i filtri sulle parole chiave

**File da modificare:** `filter.js`

Il sistema ha due liste che determinano quali notizie passano:

```js
const WHITELIST = ['ai', 'gpt', 'agent', 'llm', 'model', 'openai'];
const BLACKLIST = ['funding', 'politics', 'lawsuit', 'acquisition'];
```

- **WHITELIST** — la notizia deve contenere almeno una di queste parole per passare
- **BLACKLIST** — la notizia viene scartata se contiene anche solo una di queste parole

**Esempio — aggiungere "claude" e "gemini" alla whitelist:**

```js
const WHITELIST = ['ai', 'gpt', 'agent', 'llm', 'model', 'openai', 'claude', 'gemini'];
```

**Esempio — escludere anche notizie su acquisizioni e layoff:**

```js
const BLACKLIST = ['funding', 'politics', 'lawsuit', 'acquisition', 'layoff', 'fired'];
```

> Le parole vengono cercate nel titolo dell'articolo, non nel testo completo. Non distingue maiuscole da minuscole: scrivere `"gpt"` trova anche "GPT-4", "GPT5", ecc.

---

## 3. Modificare il criterio di qualità AI

**File da modificare:** `filter.js`

DeepSeek valuta ogni articolo con un punteggio da 0 a 10. Solo gli articoli con punteggio alto vengono trasformati in slide. La soglia attuale è 7.

Cerca questa riga:

```js
if (byIndex[j].useful && byIndex[j].score >= 7) {
```

**Esempio — abbassare la soglia a 5 per ottenere più articoli:**

```js
if (byIndex[j].useful && byIndex[j].score >= 5) {
```

**Esempio — alzare la soglia a 9 per avere solo i migliori:**

```js
if (byIndex[j].useful && byIndex[j].score >= 9) {
```

> Abbassare la soglia → più contenuti, qualità media più bassa.
> Alzare la soglia → meno contenuti, qualità più alta.

---

## 4. Cambiare il numero di slide o le parole per slide

**File da modificare:** `generate.js` e `validate.js`

### Cambiare il numero di slide

In `generate.js` il prompt inviato a DeepSeek descrive le 5 slide. Per passare a 3 slide, modifica il prompt:

```js
// Da questo (5 slide):
"slides": [
  "hook breve e forte",
  "spiegazione semplice",
  "perche e utile",
  "azione pratica",
  "esempio reale"
]

// A questo (3 slide):
"slides": [
  "hook breve e forte",
  "spiegazione semplice",
  "esempio reale"
]
```

Poi aggiorna anche `validate.js` — cambia il controllo da 5 a 3:

```js
// Da:
if (!Array.isArray(slides) || slides.length !== 5) return false;

// A:
if (!Array.isArray(slides) || slides.length !== 3) return false;
```

### Cambiare il limite di parole per slide

In `generate.js` nel prompt cambia "max 8 parole" con il numero che vuoi:

```js
// Da:
- max 8 parole per slide

// A (slide più lunghe):
- max 12 parole per slide
```

Poi aggiorna anche il controllo in `validate.js`:

```js
// Da:
return slides.every(s => s.trim().split(/\s+/).length <= 8);

// A:
return slides.every(s => s.trim().split(/\s+/).length <= 12);
```

---

## 5. Cambiare i colori del frontend

**File da modificare:** `frontend/index.html`

Cerca questa sezione nel CSS:

```css
.slide-color-0 { background: #0f172a; color: #f8fafc; }
.slide-color-1 { background: #1e293b; color: #f1f5f9; }
.slide-color-2 { background: #334155; color: #f1f5f9; }
.slide-color-3 { background: #475569; color: #f8fafc; }
.slide-color-4 { background: #0f172a; color: #94a3b8; }
```

Ogni riga corrisponde a una delle 5 slide di ogni articolo (in ordine: 1a, 2a, 3a, 4a, 5a).
`background` è il colore di sfondo, `color` è il colore del testo.

**Esempio — tema viola scuro:**

```css
.slide-color-0 { background: #1e1b4b; color: #e0e7ff; }
.slide-color-1 { background: #312e81; color: #e0e7ff; }
.slide-color-2 { background: #4338ca; color: #ffffff; }
.slide-color-3 { background: #6366f1; color: #ffffff; }
.slide-color-4 { background: #1e1b4b; color: #a5b4fc; }
```

> Per scegliere i colori usa [coolors.co](https://coolors.co) o cerca "hex color picker" su Google.

---

## 6. Aggiornare i contenuti manualmente

Quando vuoi pubblicare nuovi contenuti senza aspettare il cron automatico:

```bash
cd /home/miki/visual-scroll-blog
node run.js
git add -A
git commit -m "update contenuti"
git push
```

Dopo il push, Railway rideploya automaticamente in circa 1 minuto con le nuove slide.

---

## 7. Leggere i log

I log vengono salvati in `logs/run.log`. Per vedere gli ultimi risultati:

```bash
tail -50 /home/miki/visual-scroll-blog/logs/run.log
```

**Cosa cercare:**

| Messaggio | Significato |
|---|---|
| `Articoli fetched: 32` | Ha trovato 32 notizie dai feed |
| `Dopo AI filter: 16` | DeepSeek ne ha approvate 16 |
| `Slide generate: 14` | 14 articoli trasformati in slide con successo |
| `Fallback loggati: 2` | 2 articoli non hanno superato la validazione |
| `[cache hit]` | Articolo già processato, non ha chiamato l'API |
| `Feed ... fallito` | Un feed RSS non era raggiungibile (normale se il sito è offline) |
| `FALLBACK TRIGGERED:` | Un articolo è finito in `review_queue.json` da controllare |

---

## 8. Svuotare la cache

La cache evita di rigenerare slide per articoli già processati. Se vuoi rigenerare tutto da zero (es. hai cambiato il prompt):

```bash
echo "{}" > /home/miki/visual-scroll-blog/cache.json
```

La prossima esecuzione di `run.js` rigenererà tutte le slide chiamando DeepSeek.

> Attenzione: svuotare la cache aumenta il numero di chiamate API e quindi il costo. Fallo solo quando necessario.

---

## 9. Come funziona l'automazione GitHub Actions

Il file `.github/workflows/pipeline.yml` fa girare `run.js` automaticamente ogni 2 ore sui server di GitHub, anche con il PC spento.

### Come triggerare la pipeline manualmente (senza aspettare 2 ore)

1. Vai su `https://github.com/JhoONs117/visual-scroll-blog-`
2. Clicca su **Actions** nel menu in alto
3. Clicca su **Pipeline automatica** nella lista a sinistra
4. Clicca **Run workflow** → **Run workflow**
5. Aspetta ~5-8 minuti — Railway si aggiorna automaticamente dopo

### Come vedere i log di una esecuzione

1. Vai su **Actions** → clicca sull'esecuzione che ti interessa
2. Clicca su **run-pipeline**
3. Espandi il passo **Esegui pipeline** per vedere il riepilogo (articoli fetched, slide generate, ecc.)

### Cosa succede se la pipeline fallisce

GitHub manda una email automatica all'indirizzo dell'account. I motivi più comuni:
- **Credito DeepSeek esaurito** — ricarica su platform.deepseek.com
- **Feed RSS tutti offline** — temporaneo, riprova più tardi
- **DEEPSEEK_API_KEY mancante** — vai su GitHub → Settings → Secrets and variables → Actions e verifica che il segreto esista

### Come cambiare la frequenza (es. ogni 6 ore invece di 2)

**File da modificare:** `.github/workflows/pipeline.yml`

Cerca questa riga:

```yaml
- cron: '0 */2 * * *'
```

**Esempio — ogni 6 ore:**
```yaml
- cron: '0 */6 * * *'
```

**Esempio — una volta al giorno alle 8:00:**
```yaml
- cron: '0 8 * * *'
```

Dopo la modifica fai `git push` — GitHub applica il nuovo orario automaticamente.

### Tempi di deploy Railway

Il deploy su Railway viene triggerato automaticamente ad ogni push su `main` e impiega ~1 minuto. Questo è garantito dal file `.railwayignore` nella root del progetto, che esclude la cartella `output/` dal download di Railway:

```
# .railwayignore
output/
```

Railway serve solo `frontend/` — i JSON grezzi in `output/` non gli servono. Senza questo file, ogni backfill massiccio poteva portare i deploy a 10+ minuti. Non rimuovere `.railwayignore`.

---

## 10. Come usare la pagina di review

`frontend/review.html` è una pagina locale per leggere e copiare tutti i contenuti generati. Supporta tutti gli agenti tramite l'header sticky in cima. Utilizza lo schema v2 (`window.AGENTS`).

**Per aprirla:**

```bash
xdg-open /home/miki/visual-scroll-blog/frontend/review.html
# oppure su Windows/WSL: explorer.exe frontend/review.html
```

**Cosa mostra per ogni articolo (schema v2):**
- Titolo + data relativa ("2h fa", "ieri", "3gg fa")
- **Badge agente** (⚡ AI News / 🍳 Food / 💪 Fitness) + **status pill** (`ok` / `review_queue` / `draft`)
- **`prompt_version`** — versione del prompt usata per generare l'articolo
- Slide numerate (1-5)
- **Select canale** — dropdown X / Instagram / TikTok per visualizzare il formato corretto
- Sezioni per canale:
  - **X**: Thread (5 tweet pronti da postare)
  - **Instagram**: Caption + carousel hook
  - **TikTok**: Script video (5 righe parlate)
- Tasto **"Copia"** per canale — copia il testo del canale selezionato
- Tasto **"Approva"** per ogni articolo — imposta `status: 'approved'` nel JSON (toggle: clicca di nuovo per tornare a `draft`)

**Barra progresso FASE12:**
In cima alla pagina c'è una barra `X/30 approvati` che avanza man mano che approvi gli articoli. Quando raggiunge 30 il colore diventa verde: è la soglia per iniziare la FASE 12 (pipeline video).

**Cambiare agente:**
- Usa il dropdown nell'header sticky: ⚡ AI News / 🍳 5 Step Food / 💪 Fitness
- I dati vengono letti da `window.AGENTS[agentId]` in `data-agents.js` (generato da `build-data-agents.js`)
- Il titolo della pagina cambia automaticamente con l'agente selezionato

**Flusso di utilizzo consigliato:**
1. Apri `http://localhost:3000/review.html` (deve girare `node server.js`)
2. Scegli l'agente con il dropdown
3. Scorri gli articoli (quelli completi di thread sono mostrati per primi)
4. Seleziona il canale target con il select (X / Instagram / TikTok)
5. Click **Copia** → incolla direttamente sulla piattaforma
6. Click **Approva** sugli articoli migliori → il JSON viene aggiornato su disco

> ⚠️ Aprire `review.html` direttamente dal filesystem (`file://`) blocca il tasto Approva per CORS. Usare sempre `http://localhost:3000/review.html`.

> Legge `data-agents.js` che contiene tutti e tre gli agenti. Deve essere stato generato da `scripts/build-data-agents.js` (o dal cron GitHub Actions).

---

## 11. Come fare il backfill dei formati

Se hai articoli in `output/` senza `thread_text` (es. generati prima di M16, o perché `GENERATE_FORMATS` non era attivo):

```bash
cd /home/miki/visual-scroll-blog
node backfill.js
```

Il backfill:
1. Legge tutti i JSON in `output/`
2. Costruisce una cache dagli articoli che hanno già i formati (evita chiamate API sui duplicati)
3. Per i rimanenti chiama DeepSeek (solo quelli davvero nuovi)
4. Riscrive ogni JSON con `thread_text` e `video_script`
5. Genera `instagram_caption` per tutti gli articoli che hanno `thread_text` ma non la caption
6. Ricostruisce `frontend/data.js` deduplicato e ordinato per data

**Output atteso:**
```
File senza formati: 0 / 256
Formati già in cache (da duplicati): 74 slug unici

Articoli senza instagram_caption: 12
[caption] Titolo articolo... OK
...

frontend/data.js aggiornato con 74 articoli unici (era 256 con duplicati).

=== Fine ===
Formati da cache:     0
Formati da API:       0
Formati falliti:      0
Caption generate:     12
Caption fallite:      0
```

> ⚠️ Richiede `DEEPSEEK_API_KEY` nel file `.env`. Costa pochi centesimi per run (solo per gli articoli davvero nuovi).

> **Nota:** il backfill è idempotente — rilancia senza problemi, salta tutto ciò che è già presente. Bug fix applicato: `buildDataJs` ora ordina i file per timestamp decrescente prima della deduplicazione, garantendo sempre il file più recente per ogni slug.

---

## 12. Come funziona il layout a due assi

Il frontend (`frontend/index.html`) implementa un layout tipo Instagram Stories + TikTok feed:

```
SWIPE ORIZZONTALE → slide successiva / precedente (stessa notizia/ricetta)
SWIPE VERTICALE   → notizia/ricetta successiva / precedente
```

**Agent bar (in cima):**
- Barra fissa di 36px: dropdown ⚡ AI News / 🍳 5 Step Food / 💪 Fitness + link Review e Carousel
- `setSizes()` sottrae 36px da `--vh` per compensare — lo snap funziona correttamente
- Tutti gli agenti sono caricati da `data-agents.js` (`window.AGENTS`) — cambio agente senza fetch aggiuntivi

**Struttura HTML:**
- `#agent-bar` — barra fissa in cima, z-index 100
- `.feed` — scroll verticale con `margin-top: 36px`, una "pagina" per notizia
- `.story` — scroll orizzontale dentro ogni notizia; classe `.food-story` aggiunta per articoli food
- Ogni `.story` contiene 5 `.slide`

**Layout di ogni slide (3 aree verticali):**
- **Area visual** (50% altezza): gradiente colorato per agente (blu AI news, olive/arancio food)
- **Area content**: badge ("AI NEWS" o "5 STEP FOOD") + titolo in uppercase
- **Area info**: dot indicators + icone azione + caption con data e link sorgente

**CSS chiave:**

```css
.feed  { scroll-snap-type: y mandatory; overflow-y: scroll; margin-top: 36px; }
.story { scroll-snap-type: x mandatory; overflow-x: scroll; touch-action: pan-x pan-y; }
.slide { width: var(--slide-w); height: calc(var(--vh) * 100); scroll-snap-align: start; }
/* --vh = (viewport_height - 36px) * 0.01 — aggiustato per l'agent-bar */
```

**Palette food (classe `.food-story`):**
- Gradienti olive/arancio per slide 0-4, sovrascrivono il blu AI news
- Badge #3d5a3e (verde oliva), dot active #e07b39 (arancio), sfondo #10150f
- Fallback senza immagine: overlay con gradiente food per ogni layout (hero/right-focus/…)

**Comportamento automatico:**
- Passare a un nuovo articolo resetta automaticamente alla slide 1 (IntersectionObserver con soglia 0.6)
- Arrivare all'ultima slide e fare swipe → avanza al prossimo articolo
- Cambiare agente → feed si svuota, si ricrea da capo, scroll torna a top

---

## 13. Come rigenerare tutti gli articoli dopo un cambio di prompt

Quando si aggiorna il prompt in `generate.js` (es. dopo M22), svuotare la cache e rigenerare tutti gli articoli esistenti:

```bash
cd /home/miki/visual-scroll-blog
echo "{}" > cache.json
node regenerate-all.js
```

Il script:
1. Legge tutti i JSON in `output/`, prende un file per slug (il più recente)
2. Richiama `generateSlides()` + `generateFormats()` con i nuovi prompt
3. Sovrascrive ogni file con le nuove slide e formati
4. Ricostruisce `frontend/data.js`

Dopo il completamento, fare push per aggiornare Railway:
```bash
git add output/ frontend/data.js cache.json
git commit -m "Rigenera articoli con prompt aggiornato"
git push
```

> ⚠️ Circa 2 chiamate API per articolo × numero articoli unici. Con 45 articoli: ~90 chiamate, ~5-8 minuti, costo trascurabile con DeepSeek.

**Quando farlo:** ogni volta che si modifica il prompt in `generateSlides()` o `generateFormats()` e si vuole applicare il cambiamento anche agli articoli già salvati — tipicamente dopo M22.

---

## 14. Come fare il backfill carousel e immagini

`backfill-carousel.js` aggiunge retroattivamente `carousel_slides`, immagini Pexels (slide 2-5) e `article.image` (slide 1) a tutti gli articoli esistenti in `output/`.

> Le immagini per i nuovi articoli vengono ora fetched automaticamente da `run.js` — il backfill serve solo per articoli già salvati.

### Backfill sugli N articoli più recenti (uso normale)

```bash
cd /home/miki/visual-scroll-blog
node backfill-carousel.js --last 20
```

Processa solo i 20 articoli più recenti. Utile per aggiornare le ultime notizie senza impiegare ore sull'intero archivio.

### Backfill con sovrascrittura immagini esistenti

```bash
node backfill-carousel.js --force --last 20
```

`--force` sovrascrive le immagini Pexels già presenti. Usare quando si vuole aggiornare le foto (es. dopo aver cambiato la logica di ricerca).

### Backfill completo (tutti gli articoli)

```bash
node backfill-carousel.js --force
```

Attenzione: con ~67 articoli e rate limit Pexels (18s tra chiamate) impiega ~80 minuti. Lanciare in background.

### Backfill selettivo (slug specifici — per test)

```bash
node backfill-carousel.js nvidia cloudflare
```

Passa frammenti di slug — il backfill si limita agli articoli il cui slug li contiene. I flag `--force` e `--last` sono combinabili con i filtri slug.

### Cosa fa per ogni articolo

1. **`carousel_slides`** — se assenti, chiama DeepSeek per generarle
2. **Immagini Pexels (slide 2-5)** — cerca su Pexels con `cs.image_query`, salva URL `large2x` in `cs.image`; con `--force` sovrascrive anche quelle già presenti
3. **`article.image` (slide 1)** — se assente, estrae `og:image` dalla pagina dell'articolo

### Output atteso

```
Modalità --force: sovrascrive immagini Pexels esistenti
Modalità --last 20: processa solo i 20 articoli più recenti
Articoli unici: 67 | Da processare: 20
Chiamate Pexels previste: 76 | Tempo stimato: ~23 min

[pexels s2] Titolo articolo... OK → https://images.pexels.com/...
[pexels s3] Titolo articolo... OK → ...
[pexels s4] Titolo articolo... not found
[pexels s5] Titolo articolo... OK → ...
[image]    Titolo articolo... OK → https://techcrunch.com/...

frontend/data.js aggiornato con 67 articoli unici.

carousel_slides — Aggiornati: 0 | Già presenti: 20 | Falliti: 0
article.image  — Trovate: 4 | Non trovate: 0
pexels s2-5    — Trovate: 76 | Non trovate: 0
```

### Note operative

- "not found" su Pexels (~5-10%) — quelle slide usano il gradiente dark come fallback
- "not found" su article.image significa che il sito non ha `og:image` o blocca i bot
- Il backfill è **idempotente** senza `--force`: rilancia senza problemi, salta ciò che è già presente
- Richiede `DEEPSEEK_API_KEY` e `PEXELS_API_KEY` nel `.env`
- Dopo il completamento: `git add output/ frontend/data.js && git commit -m "backfill carousel" && git push`

---

## 15. Come scaricare le slide carousel come PNG per Instagram

C'è una sola pagina carousel unificata — usa il parametro `?agent=` per selezionare l'agente. Produce PNG 1080×1350px (4:5 esatto, pronto per Instagram).

### URL carousel

**Online (Railway):**
```
https://visual-scroll-blog-production.up.railway.app/carousel.html?agent=ai-news
https://visual-scroll-blog-production.up.railway.app/carousel.html?agent=food
```

**In locale:**
```
frontend/carousel.html?agent=ai-news   (richiede data-agents.js aggiornato)
frontend/carousel.html?agent=food      (richiede node server.js per download PNG food — vedi nota proxy)
```

Il default senza `?agent=` è `ai-news`.

### Palette per agente

| Agente | Palette | Badge | Handle |
|---|---|---|---|
| `ai-news` | Dark tech, blu/indigo | Dominio articolo dinamico | `@FlashAI` |
| `food` | Olive #3d5a3e, arancio #e07b39, crema #f7efe3 | `5 STEP FOOD` | `@FlashKitchen` |

Slide 1 food: riga sensoriale `signature_ingredients` (arancio) tra hook e micro-promessa.

### Sezioni sotto le slide (uguali per tutti gli agenti)

| Sezione | Contenuto | Uso |
|---|---|---|
| **Hook Titoli Slide** | I 5 hook in formato lista | Titoli per storie Instagram / TikTok overlay |
| **Thread X** | 5 tweet in sequenza | Incolla direttamente su X/Twitter |
| **Caption Instagram** | Testo narrativo + emoji (tasto Copia) | Descrizione per post IG |
| **Script Video (Reel / TikTok)** | 5 righe parlate, max 10 parole | Voice-over per Reel / TikTok |

Nella barra in alto: link **"↗ Fonte"** (allineato a destra) se l'articolo ha un link sorgente. Accanto alla fonte: **status pill** (colore per stato: grigio=draft, verde=approved, blu=published, giallo=scheduled, rosso=failed) e **tasto Approva** (toggle draft ↔ approved).

**Dropdown articoli:** gli articoli approvati mostrano `✅` come prefisso nel menu a tendina — a colpo d'occhio si vede cosa è già stato approvato senza selezionarlo.

**Contatore FASE12:** nella selector bar (accanto al conteggio articoli) compare `X/30 approvati` — diventa verde quando raggiungi la soglia.

### Scaricare le slide

Seleziona un articolo/ricetta dal menu, poi:

| Azione | Risultato |
|---|---|
| **Bottone "Scarica slide N"** sotto ogni slide | Scarica PNG singolo 1080×1350px |
| **Bottone "Scarica tutte e 5"** in alto | Scarica 5 PNG in sequenza |
| **Click sulla slide** | Modal con anteprima — tasto destro "Salva immagine" (desktop) / tieni premuto (mobile) |

### Nota proxy per download PNG food (locale)

Le immagini GialloZafferano non hanno CORS headers — html2canvas non può leggere i pixel direttamente. Il download PNG food richiede che `node server.js` sia in esecuzione in locale:

```bash
# In un terminale separato:
node /home/miki/visual-scroll-blog/server.js
# poi apri frontend/carousel.html?agent=food nel browser
```

Il server espone `/proxy-image?url=...` che fetcha l'immagine server-to-server (senza CORS) e la restituisce con `Access-Control-Allow-Origin: *`.

**In produzione (Railway)** `server.js` è sempre in esecuzione — il proxy funziona automaticamente.

**Immagini Pexels** (slide 2-5) non richiedono il proxy: hanno già CORS headers e `useCORS: true` le gestisce direttamente.

### Note per Instagram

- Formato: 1080×1350px (4:5) — Instagram lo accetta senza crop automatico
- Quando posti su IG seleziona **"Originale"** (non "Quadrato")
- Per un carousel a 5 slide: scarica tutte e 5 → carica in sequenza nella stessa post
- Per il food: usa la `instagram_caption` già generata (visibile sotto le slide)

### Flusso rapido per un post Instagram AI News

1. Apri `carousel.html` (o `carousel.html?agent=ai-news`)
2. Seleziona l'articolo dal menu
3. Scarica le 5 slide PNG (bottone "Scarica tutte e 5")
4. Copia la **Caption Instagram** con il tasto Copia (sotto le slide)
5. Clicca **"↗ Fonte"** per rileggere l'articolo originale se vuoi verificare i fatti
6. Su Instagram: crea nuovo post → carica i 5 PNG in ordine → incolla la caption → aggiungi hashtag manualmente

### Flusso rapido per un post Instagram food

1. Assicurati che `node server.js` sia in esecuzione (solo in locale)
2. Apri `carousel.html?agent=food`
3. Seleziona la ricetta dal menu
4. Scarica le 5 slide PNG
5. Copia la **Caption Instagram** con il tasto Copia
6. Su Instagram: carica i 5 PNG → incolla la caption → aggiungi hashtag manualmente

---

## 16. Come funziona la generazione dei contenuti

**File:** `generate.js`

Ogni articolo che supera i filtri viene processato da tre funzioni in sequenza. Capire cosa fa ognuna è utile se la qualità dei contenuti cala o se vuoi modificare il tono.

---

### 16.1 — Le 5 slide (`generateSlides`)

DeepSeek riceve il titolo dell'articolo e deve produrre 5 slide seguendo una struttura narrativa fissa.

**Struttura obbligatoria in ordine:**

| Posizione | Ruolo | Regola |
|---|---|---|
| Slide 1 | **HOOK** | Crea tensione o domanda aperta — non un titolo di giornale. Se esiste un hook più forte tra le altre slide, viene usato quello e la struttura si riordina. |
| Slide 2 | **CONTESTO** | Una sola informazione nuova |
| Slide 3 | **SORPRENDENTE** | La cosa che il lettore non si aspetta |
| Slide 4 | **PRATICO** | Cosa cambia concretamente per chi legge |
| Slide 5 | **TAKEAWAY** | Frase finale netta: azione o riflessione |

**Regola critica — tensione irrisolta:**  
Ogni slide deve lasciare una domanda aperta o un'informazione incompleta che si risolve solo nella slide successiva. Il test interno del prompt è: *"questa slide mi lascia una domanda aperta o vuole che legga la prossima?"* — se no, è sbagliata.

**Limite:** max 12 parole per slide (il prompt dice "LIMITE ASSOLUTO: conta le parole").

**Esempio DA NON FARE** (slide descrittive, tutto chiuso):
```
"OpenAI lancia GPT-5" / "È più potente di GPT-4" / "Ragiona in più passaggi" /
"Costa meno" / "Disponibile su ChatGPT da oggi"
```

**Esempio DA FARE** (ogni slide lascia qualcosa in sospeso):
```
"GPT-5 può sostituire il tuo analista?" / "Ragiona su problemi complessi in più passaggi" /
"Ma sbaglia meno degli umani solo su certi task" / "Chi non lo testa ora rischia di perdere terreno" /
"Un task reale oggi: confronta i risultati tu stesso"
```

**Come modificare la struttura delle slide:**  
Apri `generate.js` e modifica il testo della variabile `prompt` dentro `generateSlides()` (righe 28–52). Dopo ogni modifica svuota la cache (`echo "{}" > cache.json`) e rigenerai con `node regenerate-all.js`.

---

### 16.2 — Thread X e script video (`generateFormats`)

Riceve le 5 slide già generate e produce due formati pronti per la distribuzione.

#### Thread X (`thread_text`) — 5 tweet

| Tweet | Regola |
|---|---|
| **Tweet 1** | Sceglie la slide con **più tensione narrativa** tra le 5 — non necessariamente la slide 1. Può venire dalla 3 o dalla 5. L'ordine del thread si ricostruisce intorno a quella slide. |
| **Tweet 2–4** | Sviluppano con progressione (contesto → svolta → conseguenza). Non ripetono le slide — aggiungono beat narrativi nuovi. |
| **Tweet 5** | Chiude con un **fatto netto**, una conseguenza concreta o una domanda aperta. Mai con valutazioni editoriali generiche. |

Regole fisse: max 240 caratteri per tweet, niente hashtag, niente emoji forzate, tono diretto non giornalistico, ogni tweet comprensibile da solo.

**DA NON FARE** per tweet 5: `"L'AI non è più solo un sogno"` / `"Il futuro è già qui"`  
**DA FARE** per tweet 5: `"Costa meno di un abbonamento Spotify. Testalo questa settimana."`

#### Script video (`video_script`) — 5 righe

Linguaggio parlato, non scritto. Max 10 parole per riga. Come se stessi spiegando a voce a un amico. Niente sigle tecniche senza spiegazione.

**`generateFormats` viene chiamata solo se `GENERATE_FORMATS=true` in `.env`.** Se un articolo non ha `thread_text` o `video_script` nel JSON, questa variabile era assente o la funzione ha fallito (logga `generateFormats fallito:` nei log).

---

### 16.3 — Caption Instagram AI News (`generateAINewsCaption`)

Genera `instagram_caption` per ogni articolo AI News. Viene chiamata dopo `generateFormats` in `run.js` e usata da `backfill.js` per gli articoli esistenti.

**Struttura della caption:**

| Parte | Regola |
|---|---|
| Prima riga | Fatto concreto parlato — non inizia con "Oggi", "L'AI" o il titolo |
| 2-3 righe | Contesto semplificato + perché conta — niente sigle senza spiegazione |
| 1 riga | Impatto concreto per chi legge (lavoro, strumenti, quotidiano) |
| Chiusura | Domanda aperta OPPURE fatto netto — mai valutazione generica |

**Anti-pattern espliciti nel prompt:**  
`"Il futuro è già qui"` / `"L'AI sta rivoluzionando tutto"` / `"Siamo solo all'inizio"` / aggettivi come "incredibile" o "straordinario"

**Regole fisse:** 3-5 emoji pertinenti nel testo (non tutte in fondo), niente hashtag, max 120 parole.

Cache separata: `ainews:caption:<md5(title)>` — nessuna collisione con thread X, carousel o food.

**Come modificare il tono:**  
Apri `generate.js` e modifica il testo del prompt dentro `generateAINewsCaption()`. Dopo la modifica svuota solo le chiavi caption:
```bash
node -e "
const fs = require('fs');
const cache = JSON.parse(fs.readFileSync('cache.json','utf8'));
const filtered = Object.fromEntries(
  Object.entries(cache).filter(([k]) => !k.startsWith('ainews:caption:'))
);
fs.writeFileSync('cache.json', JSON.stringify(filtered, null, 2));
console.log('Cache caption AI News rimossa.');
"
node backfill.js
```

---

### 16.5 — Slide carousel Instagram (`generateCarouselSlides`)

Riceve titolo, slide e thread_text già generati. Produce i metadati per le 5 card del carousel.

Per ogni slide genera:
- `hook` — max 8 parole, tensione irrisolta (stesso principio delle slide)
- `description` — max 25 parole, condensa il tweet più pertinente senza copiarlo
- `visual_hint` — max 6 parole, elemento visivo concreto per quella slide
- `image_query` — 2-3 parole inglesi per la ricerca immagine Pexels (oggetti, luoghi, tecnologia — non ritratti di sconosciuti)
- `layout_type` — fisso per posizione: `hero` → `right-focus` → `sensor-zoom` → `human-hand` → `cta-final`
- `icon` — scelto dall'AI tra: `tag`, `waves`, `heart`, `vibration`, `check`

---

### 16.6 — Quando intervenire sulla qualità

| Sintomo | Causa probabile | Dove intervenire |
|---|---|---|
| Slide 1 troppo descrittiva, non crea curiosità | Regola HOOK ignorata | Prompt `generateSlides()` in `generate.js` riga ~34 |
| Thread parte con "Recentemente..." o ripete la slide 1 | Regola tweet 1 ignorata | Prompt `generateFormats()` in `generate.js` riga ~91 |
| Tweet 5 vago o editoriale | Regola tweet 5 ignorata | Prompt `generateFormats()` in `generate.js` riga ~93 |
| Slide troppo lunghe (>12 parole) | Limite non rispettato | Rafforzare il vincolo nel prompt `generateSlides()` |
| `carousel_slides` con description inventate | `thread_text` assente come input | Verificare che `GENERATE_FORMATS=true` nel `.env` |

Dopo ogni modifica al prompt: `echo "{}" > cache.json` → `node regenerate-all.js`

---

## 17. Variabili d'ambiente — lista completa e dove configurarle

Il progetto usa tre variabili. Ognuna deve essere impostata nei posti giusti — mancarne uno causa bug silenziosi che funzionano in locale ma non in produzione.

### Lista completa

| Variabile | Cosa fa | `.env` locale | GitHub Secrets | Railway dashboard |
|---|---|---|---|---|
| `DEEPSEEK_API_KEY` | Chiave API per generare slide, thread, script | ✅ | ✅ | ✅ |
| `PEXELS_API_KEY` | Chiave API per immagini carousel + video clip | ✅ | ✅ ⚠️ | ✅ |
| `OPENAI_API_KEY` | TTS per voiceover video (tts-1, alloy) | ✅ | — | — |
| `GIT_TOKEN` | Auto git push dopo approvazione da UI | ✅ | — | ✅ |
| `GENERATE_FORMATS` | Attiva generazione thread X e script video | ✅ (`=true`) | — | — |
| `TIKTOK_CLIENT_KEY` | Client key app TikTok sandbox | ✅ | — | — |
| `TIKTOK_CLIENT_SECRET` | Client secret app TikTok sandbox | ✅ | — | — |
| `TIKTOK_ACCESS_TOKEN` | Token OAuth per upload video TikTok (scade 24h) | ✅ | — | — |
| `TIKTOK_REFRESH_TOKEN` | Refresh token TikTok (~365gg) | ✅ | — | — |
| `INSTAGRAM_USER_ID` | ID utente Instagram Business (⏸ da configurare) | — | — | — |
| `INSTAGRAM_ACCESS_TOKEN` | Token Instagram content publish (⏸ da configurare) | — | — | — |
| `X_API_KEY` / `X_API_SECRET` | Credenziali X API (⏸ bloccato Free plan) | ✅ | — | — |
| `X_ACCESS_TOKEN` / `X_ACCESS_TOKEN_SECRET` | Token X (⏸ bloccato Free plan) | ✅ | — | — |

> `GENERATE_FORMATS` non serve su Railway (il server non genera contenuti) né come GitHub Secret (è già hardcoded in `pipeline.yml` come variabile d'ambiente del job, non segreto).

> ⚠️ **`PEXELS_API_KEY` su GitHub Secrets è critica**: senza di essa GitHub Actions genera articoli senza immagini sulle slide 2-5, senza nessun errore visibile nei log. È esattamente il bug verificato il 2026-05-11 — l'articolo "rockets for space data centers" era stato generato correttamente ma con tutte le slide 2-5 senza immagine.

### Come impostare su Railway

1. Vai su [railway.app](https://railway.app) → apri il progetto
2. Clicca sul servizio → tab **Variables**
3. Aggiungi la variabile con nome esatto e valore
4. Railway rideploya automaticamente

### Come impostare su GitHub Secrets

1. Vai su `https://github.com/JhoONs117/visual-scroll-blog-`
2. **Settings** → **Secrets and variables** → **Actions**
3. Clicca **New repository secret**
4. Nome esatto (es. `PEXELS_API_KEY`), incolla il valore, salva

### Come verificare che siano presenti

```bash
# Verifica .env locale
cat /home/miki/visual-scroll-blog/.env

# Verifica GitHub: Settings → Secrets and variables → Actions
# Verifica Railway: tab Variables del servizio
```

> ⚠️ `.env` è nel `.gitignore` — non viene mai pushato su GitHub. Ogni macchina nuova richiede di ricrearlo manualmente.

---

## 18. Checklist debug — quando qualcosa non funziona

### Il sito non mostra articoli nuovi

Controlla in questo ordine:

1. **GitHub Actions ha girato?**
   Vai su GitHub → Actions → controlla l'ultima esecuzione. Verde = OK, rosso = fallita.

2. **La pipeline ha generato articoli?**
   Clicca sull'esecuzione → espandi **Esegui pipeline** → leggi il riepilogo (`Slide generate: N`). Se N=0, il problema è nei filtri o in DeepSeek.

3. **Railway ha il deploy aggiornato?**
   Vai su railway.app → controlla che l'ultimo deploy sia successivo all'ultimo push di GitHub Actions. Se è vecchio, Railway non ha fatto autodeploy — verifica che l'integrazione GitHub sia attiva.

4. **`frontend/data.js` è aggiornato?**
   ```bash
   head -3 /home/miki/visual-scroll-blog/frontend/data.js
   ```
   Controlla che il primo articolo nell'array abbia una `savedAt` recente.

---

### Le immagini del carousel sono assenti (slide grigie)

1. **`PEXELS_API_KEY` è impostata su Railway?**
   Tab Variables su railway.app. Se manca, le slide 2-5 non hanno immagini in produzione.

2. **`article.image` è presente nei JSON?**
   ```bash
   cat /home/miki/visual-scroll-blog/output/$(ls -t output/ | head -1) | grep '"image"'
   ```
   Se il campo manca, il sito sorgente blocca i bot oppure l'articolo non ha `og:image`.

3. **Pexels restituisce errori?**
   Controlla i log di GitHub Actions — cerca `not found` o `pexels`. Un tasso > 20% di "not found" è normale; oltre indica un problema di query o rate limit.

---

### La pipeline fallisce su GitHub Actions

Apri il log dell'esecuzione fallita e cerca il messaggio di errore. Cause più frequenti:

| Messaggio nel log | Causa | Soluzione |
|---|---|---|
| `401 Unauthorized` o `Authentication failed` | `DEEPSEEK_API_KEY` scaduta o errata | Rinnova la chiave su platform.deepseek.com e aggiorna il GitHub Secret |
| `Insufficient balance` | Credito DeepSeek esaurito | Ricarica su platform.deepseek.com |
| `PEXELS_API_KEY` non definita | Secret mancante su GitHub | Aggiungi `PEXELS_API_KEY` nei GitHub Secrets (§17) |
| `git push` fallisce | Branch remoto avanti rispetto al locale | Raro nelle Actions; se succede: `git pull --rebase && git push` in locale poi re-trigger |
| Tutti i feed RSS falliti | Siti offline temporaneamente | Aspetta e re-trigger manualmente (§9) |

---

### Articoli generati ma thread/script mancanti

```bash
cat /home/miki/visual-scroll-blog/output/$(ls -t output/ | head -1) | grep '"thread_text"'
```

Se il campo non c'è:
- Verifica che `GENERATE_FORMATS=true` sia nel `.env` locale
- Verifica che `pipeline.yml` contenga `GENERATE_FORMATS: 'true'` nelle env del job
- Esegui `node backfill.js` per aggiungere retroattivamente i formati mancanti (§11)

---

### Il sito è online ma mostra contenuti vecchi dopo un push

Railway impiega ~1 minuto per fare il redeploy dopo ogni push. Se dopo 3 minuti il sito mostra ancora la versione vecchia:
1. Vai su railway.app → controlla lo stato del deploy (deve essere **Active**, non **Building** o **Failed**)
2. Se il deploy è fallito, clicca **View logs** per vedere il motivo
3. Se non ha triggerato: verifica che l'integrazione GitHub sia collegata nel tab **Settings** del servizio

---

## 19. Come gestire review_queue.json e rimuovere un articolo

### review_queue.json — cos'è e quando intervenire

`review_queue.json` raccoglie gli articoli che non hanno superato la validazione dopo 2 tentativi (slide malformate, JSON non valido, ecc.). Quando supera 10 elementi, `run.js` stampa un warning nei log.

**Ispezionare il contenuto:**
```bash
cat /home/miki/visual-scroll-blog/review_queue.json
```

Ogni elemento ha il titolo dell'articolo e l'output grezzo ricevuto da DeepSeek. Di solito la causa è una risposta JSON malformata per un titolo ambiguo o molto tecnico.

**Svuotare la coda** (dopo aver letto i casi):
```bash
echo "[]" > /home/miki/visual-scroll-blog/review_queue.json
```

> Non è necessario salvare questi articoli — se il titolo è valido, il prossimo run lo riprenderà e probabilmente lo genererà correttamente.

---

### Rimuovere un articolo specifico da output/

Se un articolo generato è sbagliato (topic errato, qualità pessima, informazione falsa):

**1. Trova il file:**
```bash
ls /home/miki/visual-scroll-blog/output/ | grep "parola-del-titolo"
```

**2. Elimina il file:**
```bash
rm /home/miki/visual-scroll-blog/output/NOME_FILE.json
```

**3. Ricostruisci `data.js`** — serve uno script per fare la dedup e il sort. Il modo più semplice è lanciare backfill-carousel senza argomenti in modalità dry (oppure aggiornare manualmente):
```bash
cd /home/miki/visual-scroll-blog
node backfill-carousel.js --last 0 2>/dev/null || node -e "
const fs = require('fs'), path = require('path');
const OUTPUT_DIR = path.join(__dirname, 'output');
const seen = new Set();
const unique = fs.readdirSync(OUTPUT_DIR)
  .filter(f => f.endsWith('.json')).sort().reverse()
  .map(f => JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, f), 'utf8')))
  .filter(a => { const k = (a.title||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,50); if(seen.has(k))return false; seen.add(k); return true; })
  .sort((a,b) => new Date(b.savedAt||0) - new Date(a.savedAt||0));
fs.writeFileSync(path.join(__dirname,'frontend','data.js'), 'window.ARTICLES = ' + JSON.stringify(unique, null, 2) + ';');
console.log('data.js aggiornato con ' + unique.length + ' articoli.');
"
```

**4. Push per aggiornare il sito:**
```bash
git add output/ frontend/data.js
git commit -m "rimuovi articolo errato"
git push
```

> Aggiungere il titolo rimosso alla BLACKLIST in `filter.js` (§2) se vuole che quel tipo di notizia non venga più raccolta.

---

## 20. Come usare il feed multi-agente

Il feed (`frontend/index.html`) mostra tutti gli agenti: AI News, 5 Step Food, Fitness. Il cambio avviene senza ricaricare la pagina. Tutti i dati sono caricati da `data-agents.js` (`window.AGENTS`).

### Cambiare agente nel feed

Usa il dropdown nell'`#agent-bar` in cima alla pagina:
- **⚡ AI News** (default): notizie AI con palette dark blu
- **🍳 5 Step Food**: ricette food con palette olive/arancio
- **💪 Fitness**: articoli fitness (quando disponibili)

I dati vengono letti da `window.AGENTS[agentId]` già caricato in `data-agents.js` — nessun fetch aggiuntivo al cambio agente.

### Navigare tra le pagine

Dalla `#agent-bar` (in alto a destra):
- **Review** → `review.html` — contenuti completi, copia testo per canale
- **Carousel** → `carousel.html?agent=<id>` — anteprima e download PNG

Da `review.html` e dalla pagina carousel ci sono link per tornare al feed.

### Identificare l'agente nel feed

| Elemento | AI News | 5 Step Food | Fitness |
|---|---|---|---|
| Badge | NOTIZIA / CONTESTO / … | 5 STEP FOOD | FITNESS |
| Gradiente visual | Dark blue/indigo | Olive/arancio radiale | (palette propria) |
| Dot attivo | Blu `#3b82f6` | Arancio `#e07b39` | Colore fitness |
| Sorgente (sotto slide) | "AI News · N ore fa · link" | "5 Step Food · N ore fa · link" | "Fitness · N ore fa · link" |

### Dati: `data-agents.js` e `build-data-agents.js`

`frontend/data-agents.js` è generato da `scripts/build-data-agents.js` che legge:
- `output/` → agente `ai-news`
- `output/food/` → agente `food`
- `output/fitness/` → agente `fitness`

Il file è aggiornato automaticamente dalla pipeline GitHub Actions ad ogni run. Per rigenerarlo manualmente:
```bash
cd /home/miki/visual-scroll-blog
node scripts/build-data-agents.js
```

---

## 21. Come eseguire e configurare la pipeline food

### Esecuzione manuale (singolo articolo — test)

```bash
cd /home/miki/visual-scroll-blog
MAX_NEW_FOOD_ARTICLES=1 node run-food.js
```

Processa un solo articolo dal feed Giallozafferano. Usa la cache — se l'articolo è già stato processato in precedenza salta le chiamate API. Scrive sempre `frontend/data-food.js`.

### Esecuzione normale (3 articoli — stesso comportamento di CI)

```bash
MAX_NEW_FOOD_ARTICLES=3 node run-food.js
```

### Trigger CI manuale

La pipeline food gira automaticamente ogni 2 ore. Per triggerare manualmente:

1. GitHub → Actions → **Pipeline automatica** → **Run workflow**
2. Il passo food (`node run-food.js`) parte dopo il completamento del passo AI news
3. Controlla il log del passo food cercando `"Food agent completato"` — se vedi `"Food pipeline failed"` significa che è scattato l'`|| echo` (vedi §18)

### Aggiungere un feed food

**File da modificare:** `fetch-food.js`

```js
const FEEDS = [
  'https://www.giallozafferano.it/feed',
  // 'https://www.foodmakers.it/feed',  // riattivare dopo test
  'https://nuovo-sito-ricette.it/feed',  // ← aggiungere qui
];
```

Il feed deve contenere ricette reali (ingredienti + procedimento). Il gate `looksLikeRecipe` scarta automaticamente articoli magazine che non contengono ingredienti e preparazione.

### Svuotare la cache food

Per rigenerare le slide food dopo un cambio di prompt (senza toccare la cache AI news):

```bash
node -e "
const fs = require('fs');
const cache = JSON.parse(fs.readFileSync('cache.json','utf8'));
const filtered = Object.fromEntries(
  Object.entries(cache).filter(([k]) =>
    !k.startsWith('food:slides:') && !k.startsWith('food:carousel:') &&
    !k.startsWith('food:caption:') && !k.startsWith('food:video:') && !k.startsWith('food:thread:')
  )
);
fs.writeFileSync('cache.json', JSON.stringify(filtered, null, 2));
console.log('Cache food rimossa.');
"
```

Poi rilancia `run-food.js` per rigenerare.

### Rimuovere una ricetta da output/food/

```bash
ls /home/miki/visual-scroll-blog/output/food/ | grep "parola-slug"
rm /home/miki/visual-scroll-blog/output/food/NOME_FILE.json
# Poi rigenera data-food.js:
MAX_NEW_FOOD_ARTICLES=0 node run-food.js
```

Con `MAX_NEW_FOOD_ARTICLES=0` non processa nuovi articoli ma ricostruisce `data-food.js` dal contenuto attuale di `output/food/`.

---

## 22. Come scaricare i carousel food come PNG

`carousel-food.html` è stato rimosso. Il carousel food è ora integrato in `carousel.html?agent=food`.

Vedi **§15** per la procedura completa — il flusso rapido per food è incluso lì.

---

## 23. Come approvare articoli per FASE 12

La FASE 12 (pipeline video automatica) richiede almeno **30 articoli approvati** prima di essere avviata. Il meccanismo di approvazione è già implementato.

### Dove approvare

**Da Railway (consigliato — nessun server locale necessario):**
1. Vai su `https://visual-scroll-blog-production.up.railway.app/carousel.html?agent=ai-news`
2. Seleziona un articolo dal menu a tendina
3. Controlla le 5 slide, il thread X, la caption
4. Click **Approva** — il pill diventa verde e il commit viene pushato automaticamente su git

**Da `review.html`:**
- `https://visual-scroll-blog-production.up.railway.app/review.html`
- Click **Approva** in fondo a ogni articolo

### Come funziona internamente

`POST /api/set-status` in `server.js`:
- Aggiorna `status: "approved"` in **tutti** i file con quello slug (non solo il più recente)
- Lancia in background: `build-data-agents.js` → `git commit` → `git push` automatico se `GIT_TOKEN` è configurato
- `build-data-agents.js` preserva sempre lo status più alto tra i duplicati (`approved` batte `draft`) — un'approvazione non viene mai persa anche se la pipeline rigenera lo stesso articolo

Il toggle funziona: cliccare di nuovo su un articolo approvato lo riporta a `draft`.

### Come salvare le approvazioni su Railway

**Automatico se `GIT_TOKEN` è configurato** (già fatto): ogni approvazione da UI fa automaticamente `git commit + push` → Railway rideploya con lo status aggiornato.

Se per qualche motivo il push automatico non avviene (es. GIT_TOKEN scaduto), salva manualmente:

```bash
git add output/ output/food/ output/fitness/ frontend/data-agents.js
git commit -m "approva articoli per FASE 12 (X/30)"
git push
```

### Indicatori visivi

| Dove | Indicatore |
|---|---|
| Dropdown `carousel.html` | `✅ ✓ Titolo` — prefisso emoji per gli approvati |
| Selector bar `carousel.html` | `X/30 approvati` (verde quando ≥ 30) |
| Pill articolo in `carousel.html` | Verde chiaro con testo "approved" |
| Barra `review.html` | Barra di progresso con fill verde |
| Pill articolo in `review.html` | Verde con testo "approved" |

---

## 24. Come generare video

> ⚠️ **Questo è il sistema video V1 (legacy).** Il sistema attuale è **V2** — vedi §30.
> Il V1 usa `render/render-video.js` con clip Pexels. Il V2 usa `video/render-pending.js` con slide carousel animate.

Per generare video usa il §30 (pipeline V2 slide-deck).

---

## 25. Come pubblicare su TikTok

**Prerequisito:** articolo con `status: approved` e `render_status: rendered` + `TIKTOK_ACCESS_TOKEN` in `.env`.

```bash
node publish/publisher-tiktok.js --agent ai-news --slug SLUG
```

Il video viene caricato come **bozza** nel tuo profilo TikTok (scope `video.upload` sandbox). Ricevi una notifica sull'app TikTok → tappa la notifica → pubblica manualmente.

**Note importanti:**
- Il token scade ogni 24h — rinnovalo prima di pubblicare (§29)
- In sandbox: il video appare come bozza, non viene pubblicato direttamente
- Per la pubblicazione diretta serve `video.publish` (richiede app review di TikTok)
- Il publisher aggiorna `publish_status.tiktok: published` nel JSON dopo il successo

---

## 26. Come pubblicare su Instagram

🔒 **BLOCCATO** — account Instagram ristretto da Meta. Impossibile creare App su `developers.facebook.com` con "Instagram Use Case" finché l'account non viene sbloccato/verificato da Meta.

Quando sbloccato, il setup richiede:
1. `developers.facebook.com` → crea App → seleziona "Instagram Use Case"
2. Permessi: `instagram_basic`, `instagram_content_publish`
3. Collega Instagram Business account → genera Long-Lived User Access Token
4. Aggiungi in `.env`: `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN`

Poi:
```bash
node publish/publisher-instagram.js --agent ai-news --slug SLUG
```

Pubblica un carousel con le immagini già presenti in `formats.instagram.carousel[].image` (URL Pexels). Se un'immagine manca la recupera da Pexels in automatico.

---

## 27. Come pubblicare su X (Twitter)

⏸ **Bloccato** — X API Free non permette `POST /tweets`. Serve piano Basic ($100/mese).

Quando aggiornato il piano, aggiungere in `.env`:
```
X_API_KEY=...
X_API_SECRET=...
X_ACCESS_TOKEN=...
X_ACCESS_TOKEN_SECRET=...
```

Poi:
```bash
node publish/publisher-x.js --agent ai-news --slug SLUG
```

Pubblica un thread di 5 tweet da `formats.x.thread`.

---

## 28. Come usare lo scheduler

Lo scheduler pubblica automaticamente su tutti i canali configurati tutti gli articoli `approved + rendered` non ancora pubblicati.

```bash
# Vedi cosa verrebbe pubblicato senza farlo
node publish/scheduler.js --agent ai-news --dry-run

# Pubblica su tutti i canali
node publish/scheduler.js --agent ai-news

# Pubblica solo su canali specifici
node publish/scheduler.js --agent ai-news --channels tiktok
node publish/scheduler.js --agent ai-news --channels instagram,tiktok
```

Lo scheduler:
- Prende il file più recente per ogni slug (evita duplicati)
- Salta gli articoli già pubblicati su quel canale
- Se un canale fallisce, continua con il successivo (non blocca)
- Esce con codice 1 se almeno un canale fallisce (utile per CI)

**Abilitare in CI (GitHub Actions):** solo dopo aver raggiunto 30 articoli approvati e validato tutti i canali manualmente. Aggiungere un passo nel workflow `pipeline.yml`.

---

## 29. Come rinnovare il token TikTok

Il token TikTok (`TIKTOK_ACCESS_TOKEN`) scade ogni **24 ore**. Il refresh token dura ~365 giorni.

### Rinnovo rapido (automatico)

```bash
node scripts/refresh-tiktok-token.js
```

Legge `TIKTOK_REFRESH_TOKEN` da `.env`, ottiene un nuovo access token e **aggiorna `.env` in automatico**. Da eseguire prima di ogni sessione di publishing.

### Se il refresh token è scaduto (dopo ~365 giorni)

Serve un nuovo OAuth completo:

```bash
node scripts/get-tiktok-token.js
# Apre il browser → autorizza → stampa i nuovi token
```

Oppure manualmente:
1. Apri nel browser:
   ```
   https://www.tiktok.com/v2/auth/authorize/?client_key=sbawode6shdbahuqfk&scope=user.info.basic,video.upload&response_type=code&redirect_uri=https%3A%2F%2Fvisual-scroll-blog-production.up.railway.app%2Ftiktok-callback&state=test123
   ```
2. Autorizza con il tuo account TikTok
3. Railway mostra il codice a schermo
4. Esegui: `node scripts/exchange-tiktok-code.js <CODICE>`
5. Copia i nuovi token in `.env`

---

## 30. Come generare video V2 (pipeline slide-deck)

Il sistema V2 genera video verticali 9:16 (1080×1920) usando le slide del carousel come base, animate con zoom/pan e voiceover TTS. I piani video (5 scene) vengono generati automaticamente dal CI ogni 2 ore.

### Prerequisiti per renderizzare un video

1. Articolo con `status: approved`
2. `render_quality` impostato (`low` / `medium` / `high`)
3. Piano video generato (`formats.video.scenes` non vuoto) — **fatto dal CI automaticamente**
4. Slide carousel salvate come PNG in `output/{agentId}/slides-png/{slug}/slide{0-4}.png`

### Flusso giornaliero

**Nel browser (`carousel.html?agent=ai-news` su Railway):**
1. Trova l'articolo
2. Clicca **Approva** — viene pushato su git automaticamente
3. Seleziona **▶ Low** dal dropdown qualità video — viene pushato su git automaticamente
4. Clicca **💾 Salva per video** — aspetta "✅ 5 slide salvate"
   - Il browser scarica `slide0.png`…`slide4.png` automaticamente (atterrano in `/home/miki/visual-scroll-blog/`)
5. Aspetta che il CI (ogni 2h) generi il piano video — oppure triggeralo manualmente da GitHub Actions → Run workflow

**Nel terminale (UN SOLO COMANDO):**
```bash
node video/render-pending.js
```

Il comando fa tutto in automatico:
- Importa le PNG da `/home/miki/visual-scroll-blog/slide*.png` nella cartella corretta
- Renderizza tutti gli articoli pronti (approved + quality + scenes + PNG)
- Esegue `build-data-agents.js`
- Committa e pusha su git
- Railway rideploya in ~1 min → player video appare su `carousel.html`

**Non serve nient'altro.**

### Generare il piano video manualmente (senza aspettare il CI)

```bash
node video/generate-video-plan.js --agent ai-news --slug <slug>
```

### Renderizzare un singolo articolo

```bash
node video/render-video-v2.js --agent ai-news --slug <slug>
```

### Dove trovare lo slug

Il file JSON in `output/` ha sempre il formato `{timestamp}_{slug}.json`. Lo slug è la parte dopo il primo `_`.

### File della pipeline video V2

| File | Funzione |
|---|---|
| `video/generate-video-plan.js` | Genera 5 scene via GPT-4o-mini (CI: flag `--ci`) |
| `video/validate-video-plan.js` | Valida il piano: 5 scene, 18-35s, qualità ≥75 |
| `video/generate-slides-916.js` | Converte PNG carousel 1080×1350 → 1080×1920 (priority: locale → Pexels) |
| `video/render-video-v2.js` | Entry point CLI: legge template dall'articolo e renderizza |
| `video/render-pending.js` | Batch: trova e renderizza tutti gli articoli pronti |
| `video/templates/slide-deck.js` | Template: animazione zoompan + TTS OpenAI + subtitle |

### Qualità e template

| Qualità | Template | Descrizione |
|---|---|---|
| `low` | `slide_deck` | Slide carousel animate con zoom/pan + voiceover TTS |
| `medium` | `data_reveal` | Non ancora implementato |
| `high` | `avatar_presenter` | Non ancora implementato |

### Endpoint server aggiunti (server.js)

| Endpoint | Funzione |
|---|---|
| `POST /api/set-render-quality` | Imposta `render_quality` sull'articolo |
| `POST /api/save-carousel-png` | Salva le slide PNG dal browser su disco |
| `GET /renders/{filename}.mp4` | Serve il video renderizzato al player in carousel.html |

### Pubblicare i video su Railway

`render-pending.js` fa tutto automaticamente (build + commit + push). Non serve eseguire comandi aggiuntivi.

> **Se necessario pushare manualmente** (es. dopo un reset di render_status):
> ```bash
> node scripts/build-data-agents.js
> git add output/ frontend/data-agents.js
> git commit -m "feat: video renderizzati"
> git pull --rebase --autostash && git push
> ```

### Video in locale vs Railway

- I video MP4 sono tracciati in git (`output/renders/*.mp4` — inclusi, `output/renders/audio/` — esclusi)
- Una volta pushati su GitHub, Railway li serve indipendentemente da quello che hai in locale
- Puoi eliminare i file locali per fare spazio senza conseguenze su Railway
- L'unico modo per rimuoverli da Railway è: `git rm output/renders/{slug}.mp4` + commit + push
- Questo comando **non viene mai eseguito automaticamente** — solo tu puoi farlo manualmente

### Note importanti

- **Non serve il server locale** — "Salva per video" funziona da Railway e scarica le PNG nel browser
- Le PNG scaricate atterrano in `/home/miki/visual-scroll-blog/` (browser configurato sulla root del progetto WSL2)
- `render-pending.js` le importa automaticamente dalla root in `output/{agentId}/slides-png/{slug}/`
- I video renderizzati finiscono in `output/renders/{slug}.mp4`
- `render_status.low = "done"` nel JSON indica video già renderizzato (saltato da `render-pending.js`)
- Per re-renderizzare: `render_status.low = null` nel JSON, poi rilancia `render-pending.js`
- `OPENAI_API_KEY` configurato nei GitHub Actions secrets
- **Audio:** OpenAI TTS genera audio a 24kHz → ricampionato a 44100Hz in concat per compatibilità browser
- **CI push:** usa `git pull --rebase --autostash` per evitare rejected quando Railway ha pushato in parallelo
