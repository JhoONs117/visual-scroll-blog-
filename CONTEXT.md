# CONTEXT — Visual AI Scroll Blog

Stato aggiornato al: 2026-05-05

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
| `run.js` | Entry point — orchestra l'intera pipeline + scrive `frontend/data.js` |
| `server.js` | HTTP server minimale — serve `frontend/` su Railway |
| `fetch.js` | Legge i feed RSS, restituisce `{ title, link, pubDate }[]` |
| `filter.js` | `deduplicate`, `hardFilter`, `batchAIFilter` |
| `deepseek.js` | Wrapper `callDeepSeek(prompt)` → stringa risposta |
| `generate.js` | `generateSlides(title)` → `{ title, slides[5] }`, con cache |
| `validate.js` | `isValid`, `validateWithFallback` con fallback su `review_queue.json` |
| `cache.json` | Cache persistente hash→slides (evita chiamate API duplicate) |
| `review_queue.json` | Articoli che non hanno superato la validazione dopo 2 tentativi |
| `output/` | File JSON generati dalla pipeline, uno per articolo |
| `frontend/index.html` | Pagina scroll-snap dinamica |
| `frontend/data.js` | Generato da `run.js` — contiene `window.ARTICLES = [...]` |
| `.github/workflows/pipeline.yml` | GitHub Actions — cron ogni 2 ore |

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
