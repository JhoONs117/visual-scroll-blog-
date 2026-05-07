# CONTEXT — Visual AI Scroll Blog

Stato aggiornato al: 2026-05-07

---

## Cos'è il progetto

Sistema automatico che:
1. Recupera articoli AI da feed RSS ogni 2 ore
2. Li filtra (deduplica → hard filter → AI filter con DeepSeek)
3. Genera 5 slide per ogni articolo valido
4. Le salva come JSON in `output/` e aggiorna `frontend/data.js`
5. Le mostra come pagina scroll-snap su mobile via Railway

---

## Stack

- **Node.js** — runtime
- **DeepSeek API** (`deepseek-chat`) — AI filter + generazione slide
- **rss-parser** — lettura feed RSS
- **axios** — chiamate HTTP
- **md5** — hash per cache
- **dotenv** — variabili d'ambiente
- **HTML/CSS puro** — frontend scroll-snap, nessuna dipendenza esterna
- **GitHub Actions** — esecuzione automatica pipeline ogni 2 ore
- **Railway** — hosting del server Node.js, auto-deploy su push

---

## File principali

| File | Ruolo |
|---|---|
| `run.js` | Entry point — orchestra pipeline, dedup cross-run, scrive `frontend/data.js` (sort desc) |
| `backfill.js` | Backfill formati su articoli esistenti senza `thread_text` (cache → API) |
| `regenerate-all.js` | Rigenera slide + formati per tutti gli articoli unici con i prompt aggiornati |
| `backfill-links.js` | Retroattivamente aggiunge il campo `link` ai JSON dai feed RSS correnti |
| `server.js` | HTTP server minimale — serve `frontend/` su Railway |
| `fetch.js` | Legge i feed RSS, restituisce `{ title, link, pubDate }[]` |
| `filter.js` | `deduplicate`, `hardFilter`, `batchAIFilter` |
| `deepseek.js` | Wrapper `callDeepSeek(prompt)` → stringa risposta |
| `generate.js` | `generateSlides(title)` + `generateFormats(title, slides)`, con cache |
| `validate.js` | `isValid`, `validateWithFallback` con fallback su `review_queue.json` |
| `cache.json` | Cache persistente hash→slides (evita chiamate API duplicate) |
| `review_queue.json` | Articoli che non hanno superato la validazione dopo 2 tentativi |
| `output/` | File JSON generati dalla pipeline, uno per articolo (formato: `timestamp_slug.json`) |
| `frontend/index.html` | Frontend Instagram-style: scroll verticale feed + scroll orizzontale slide |
| `frontend/review.html` | Pagina review locale: tutti gli articoli con thread X, script video, "Copia tutto" |
| `frontend/data.js` | Generato da `run.js` — `window.ARTICLES = [...]`, ordinato dal più recente |
| `.github/workflows/pipeline.yml` | GitHub Actions — cron ogni 2 ore, `GENERATE_FORMATS=true` |

---

## Milestones completate

### M1 — Setup progetto ✅
- `npm init -y`, dipendenze installate (axios, rss-parser, dotenv, md5)
- Struttura file completa, `.env` con `DEEPSEEK_API_KEY`, `.gitignore`

### M2 — Connessione DeepSeek ✅
- `deepseek.js`: `callDeepSeek(prompt)` chiama `https://api.deepseek.com/v1/chat/completions`
- Modello: `deepseek-chat`
- Test: `node deepseek.js` risponde "ok"

### M3 — Raccolta RSS ✅
- `fetch.js`: legge 3 feed (O'Reilly 404, AI News ✅, TechCrunch ✅)
- Errori per singolo feed non bloccano gli altri (`Promise.allSettled`)
- Restituisce ~32 articoli

### M4 — Deduplicazione e hard filter ✅
- `normalize(title)`: lowercase, solo alfanumerici, prime 5 parole
- `deduplicate(articles)`: Set su titoli normalizzati
- `hardFilter(articles)`: whitelist AI + blacklist noise
- Pipeline: 32 → 32 → 25

### M5 — AI filter con batch DeepSeek ✅
- `batchAIFilter(articles)`: batch da 10, prompt JSON strutturato
- DeepSeek valuta `useful` (bool) e `score` (0-10)
- Passano solo articoli con `useful=true` e `score >= 7`
- Pipeline: 25 → 16

### M6 — Generazione slide ✅
- `generateSlides(title)`: prompt DeepSeek → 5 slide, max 8 parole ciascuna
- Parse robusto con regex su risposta grezza
- Restituisce `{ title, slides[5] }`

### M7 — Validazione e fallback ✅
- `isValid(slides)`: esattamente 5 slide, max 8 parole ciascuna
- `validateWithFallback(title, generateFn)`: max 2 tentativi, poi scrive in `review_queue.json`
- Se `review_queue.json` supera 10 elementi → `console.warn`

### M8 — Cache ✅
- `generate.js` carica `cache.json` in memoria all'avvio
- Key: `md5(normalize(title))`
- Cache hit → nessuna chiamata API
- Cache aggiornata su disco dopo ogni generazione valida

### M9 — Pipeline completa in run.js ✅
- Flusso: fetch → dedup → hardFilter → batchAIFilter → validateWithFallback → salva JSON → scrive data.js
- Output: `output/{{timestamp}}_{{slug}}.json`
- Riepilogo finale a console

### M10 — Frontend scroll-snap ✅
- `frontend/index.html`: CSS scroll-snap puro
- `scroll-snap-type: y mandatory`, ogni slide `100vh`
- Palette monocromatica slate (#0f172a → #475569)

### M11 — Frontend dinamico ✅
- `run.js` scrive `frontend/data.js` con `window.ARTICLES = [...]`
- `index.html` renderizza le slide reali in JS puro
- Colori ciclano per gruppo di 5 slide con classi `.slide-color-0..4`
- Se `ARTICLES` è vuoto mostra "Nessun articolo disponibile"

### M12 — Automazione GitHub Actions ✅
- `.github/workflows/pipeline.yml`: cron `0 */2 * * *`
- Esegue `node run.js`, committa `output/` e `frontend/data.js`, pusha
- `DEEPSEEK_API_KEY` salvata come GitHub Secret
- Trigger manuale disponibile da GitHub → Actions → Run workflow
- Log visibili direttamente su GitHub Actions

### M13 — Deploy Railway ✅
- Deploy su Railway collegando il repo GitHub
- `npm start` esegue solo `node server.js`
- Auto-deploy attivo: ogni push di GitHub Actions triggera un nuovo deploy
- `DEEPSEEK_API_KEY` impostata anche come variabile d'ambiente in Railway
- `server.js`: HTTP server minimale, legge `PORT` da env

### M14 — Riscrittura prompt slide ✅ (2026-05-06)
- Prompt `generateSlides()` riscritto con struttura narrativa a 5 ruoli fissi:
  Slide 1=HOOK (domanda/affermazione che crea tensione), 2=CONTESTO, 3=SORPRENDENTE, 4=PRATICO, 5=TAKEAWAY
- 2 esempi completi nel prompt (DA NON FARE + DA FARE) con titoli e slide complete
- Limite 8 parole reso esplicito e prominente ("LIMITE ASSOLUTO: conta le parole")
- Cache svuotata dopo la modifica
- 10 output di esempio in `test-output/` — 8-9/10 hook creano tensione reale
- Fallback sceso da 60% a ~8% rispetto alla versione semplice del prompt

**Da fare (test manuale):** apri `test-output/`, leggi solo la slide 1 di ogni file,
chiediti "fa venire voglia di leggere la prossima?" — se meno di 8/10 sì, torna a migliorare il prompt.

### M16 — Output multi-formato ✅ (2026-05-06)
- `generate.js`: aggiunta funzione `generateFormats(title, slides)` separata da `generateSlides()`
- Chiama DeepSeek con le 5 slide e produce `{ thread_text: string[5], video_script: string[5] }`
- Validazione interna: retry 1 volta se JSON non valido o campi mancanti; restituisce null se fallisce ancora
- `run.js`: importa `generateFormats`, la chiama solo se `GENERATE_FORMATS=true` in env
- Se `generateFormats` restituisce null, l'articolo viene salvato comunque senza quei campi
- `.env`: aggiunto `GENERATE_FORMATS=true`
- I campi `thread_text` e `video_script` sono inclusi nei JSON in `output/` e in `frontend/data.js`

### M17 — Pagina di review ✅ (2026-05-06)
- `frontend/review.html` con tema dark (#0f172a), unico tasto "Copia tutto" per articolo
- Mostra: titolo, data relativa (`timeAgo`), slide numerate, Thread X, Script video
- Copia negli appunti l'intero articolo (titolo + slide + thread + script) in un click
- Articoli con formati mostrati prima di quelli senza (ordinamento visivo interno)
- `overflow-wrap: break-word` su tutti gli elementi testuali

### Backfill formati ✅ (2026-05-06)
- `backfill.js`: retroattivamente aggiunge `thread_text` e `video_script` a 226 JSON in `output/`
- Costruisce una `formatCache` dai file che hanno già i formati (da duplicati) → evita chiamate API superflue
- Risultato: 75 da cache, 11 da API, 0 fallimenti → 44 articoli unici in `data.js`
- Rebuild finale di `data.js` con deduplicazione per slug e ordinamento decrescente per data

### M15 — Frontend UX a due assi ✅ (2026-05-06)
- `frontend/index.html` completamente riscritto con layout Instagram-style a 3 aree:
  - `.slide-visual` (50% h, gradiente colorato per articolo)
  - `.slide-content` (badge "AI NEWS" + linee blu + titolo uppercase centrato su nero)
  - `.slide-info` (dot indicators + icone SVG like/comment/share + caption con `timeAgo`)
- Scroll verticale sul `.feed` (cambio articolo) + scroll orizzontale su `.story` (cambio slide)
- `touch-action: pan-x pan-y` su `.story` — permette entrambi gli assi nativamente
- CSS variable `--slide-w` da `document.documentElement.clientWidth` — evita overflow su Android
- `window.visualViewport.height` per `--vh` — corretto con address bar Chrome Android
- IntersectionObserver per reset slide 1 al cambio articolo (threshold 0.6)
- Edge case: ultima slide + swipe → avanza al prossimo articolo via `feed.scrollBy`
- Tutti i 7 scenari di test superati su mobile reale

### Bug fix: cross-run deduplication ✅ (2026-05-06)
- `run.js`: carica slug esistenti da `output/` prima di girare, salta articoli già salvati
- Stesso articolo non viene più scritto 18 volte in run successivi
- `data.js` ora deduplica per slug e ordina per `savedAt` decrescente (più recenti prima)

### Bug fix: GENERATE_FORMATS in GitHub Actions ✅ (2026-05-06)
- `pipeline.yml`: aggiunto `GENERATE_FORMATS: 'true'` nelle env del passo pipeline
- Formati ora generati automaticamente ad ogni run di CI

### PRE-M21 — Fix prompt generateSlides + generateFormats ✅ (2026-05-07)
- `generateSlides()`: aggiunto vincolo "tensione irrisolta" — ogni slide deve lasciare domanda aperta o info incompleta. Slide 1 può ancorare sul nome azienda/protagonista purché aggiunga tensione; se un'altra slide ha hook più forte, riordina la struttura.
- `generateFormats()`: tweet 1 scelto dalla slide con più tensione narrativa (non necessariamente slide 1); tweet 5 chiude con fatto netto/conseguenza/domanda — vietate valutazioni editoriali generiche
- Testato su 3 articoli: tutti i criteri superati (3/3 tweet 1, 3/3 tweet 5)
- `regenerate-all.js`: rigenerati **45/45 articoli** con i nuovi prompt, 0 fallimenti

### Fix review.html: titolo e link fonte ✅ (2026-05-07)
- Titolo non va più a capo parola per parola: aggiunto `flex-wrap: wrap` su `.article-header` e `min-width: 0` su `.article-title`
- Ogni articolo mostra "↗ Fonte" (link diretto) o "↗ Cerca" (Google Search) accanto alla data
- `run.js`: ora salva il campo `link` dell'articolo nei JSON di output
- `backfill-links.js`: recuperato link RSS per 20/45 articoli esistenti; i restanti 25 (non più in feed) hanno fallback Google Search

### Fix index.html: titolo cliccabile in caption ✅ (2026-05-07)
- In `.slide-source` il titolo dell'articolo è ora un `<a>` cliccabile (link diretto o Google Search)
- Stile: leggermente più luminoso del testo circostante, si scurisce al tap su mobile

### Bug fix: data relativa ✅ (2026-05-06)
- `run.js`: salva `pubDate` (dalla fonte RSS) e `savedAt` (timestamp di run) su ogni articolo
- `timeAgo()` implementata in `index.html` e `review.html` — mostra "2h fa", "ieri", "3gg fa"

---

## Flusso autonomo completo

```
ogni 2 ore
  └── GitHub Actions esegue run.js
        └── fetch RSS → filter → AI filter → generate slides
              └── salva output/*.json + frontend/data.js
                    └── git commit + push
                          └── Railway rideploya automaticamente
                                └── sito aggiornato online
```

---

## Note operative

- **Feed O'Reilly** restituisce 404 — ignorato automaticamente
- **DeepSeek cost**: ~pochi centesimi per run, la cache azzera il costo sugli articoli già visti
- **GitHub Actions**: gratuito fino a 2000 min/mese — il progetto ne usa ~30/mese
- **Token GitHub**: quello con scope `workflow` è necessario per pushare il file `.github/workflows/`
- **WSL cron**: installato ma non necessario — GitHub Actions è la fonte primaria di automazione
