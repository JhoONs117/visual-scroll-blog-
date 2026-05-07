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

---

## 10. Come usare la pagina di review

`frontend/review.html` è una pagina locale (non linkata dal sito pubblico) per leggere e copiare tutti i contenuti generati.

**Per aprirla:**

```bash
# Apri direttamente nel browser (non serve Railway)
xdg-open /home/miki/visual-scroll-blog/frontend/review.html
# oppure su Windows/WSL: explorer.exe frontend/review.html
```

**Cosa mostra per ogni articolo:**
- Titolo + data relativa ("2h fa", "ieri", "3gg fa")
- Slide numerate (1-5)
- Thread X (5 tweet pronti da postare)
- Script video (5 righe parlate)
- Tasto **"Copia tutto"** → copia in un click titolo + slide + thread + script

**Flusso di utilizzo consigliato:**
1. Apri `review.html`
2. Scorri gli articoli (quelli completi di thread sono mostrati per primi)
3. Leggi il thread di un articolo — ti sembra postabile?
4. Se sì: click **Copia tutto** → incolla su X o LinkedIn

> La pagina legge `data.js` — deve essere aggiornata prima (`node run.js` o aspetta il cron di GitHub Actions).

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
5. Ricostruisce `frontend/data.js` deduplicato e ordinato per data

**Output atteso:**
```
File senza formati: 11 / 226
Formati già in cache (da duplicati): 40 slug unici

[1/11] Titolo articolo... OK (API)
...

frontend/data.js aggiornato con 44 articoli unici (era 226 con duplicati).
```

> ⚠️ Richiede `DEEPSEEK_API_KEY` nel file `.env`. Costa pochi centesimi per run (solo per gli articoli davvero nuovi).

---

## 12. Come funziona il layout a due assi

Il frontend (`frontend/index.html`) implementa un layout tipo Instagram Stories + TikTok feed:

```
SWIPE ORIZZONTALE → slide successiva / precedente (stessa notizia)
SWIPE VERTICALE   → notizia successiva / precedente
```

**Struttura HTML:**
- `.feed` — scroll verticale, una "pagina" per notizia
- `.story` — scroll orizzontale dentro ogni notizia, una pagina per slide
- Ogni `.story` contiene 5 `.slide`

**Layout di ogni slide (3 aree verticali):**
- **Area visual** (50% altezza): gradiente colorato unico per notizia
- **Area content**: badge "AI NEWS" + titolo in uppercase su sfondo nero
- **Area info**: dot indicators per la slide attiva + icone like/commento/condividi + caption con data

**CSS chiave:**

```css
.feed  { scroll-snap-type: y mandatory; overflow-y: scroll; }
.story { scroll-snap-type: x mandatory; overflow-x: scroll; touch-action: pan-x pan-y; }
.slide { width: var(--slide-w); height: var(--vh); scroll-snap-align: start; }
```

> `--slide-w` e `--vh` sono impostati da JS (`document.documentElement.clientWidth` e `window.visualViewport.height`) per correggere comportamenti su Android Chrome con la address bar visibile.

**Comportamento automatico:**
- Passare a un nuovo articolo resetta automaticamente alla slide 1 (IntersectionObserver con soglia 0.6)
- Arrivare all'ultima slide e fare swipe → avanza al prossimo articolo

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
