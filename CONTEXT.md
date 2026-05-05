# CONTEXT — Visual AI Scroll Blog

Stato aggiornato al: 2026-05-05

---

## Cos'è il progetto

Sistema automatico che:
1. Recupera articoli AI da feed RSS
2. Li filtra (deduplica → hard filter → AI filter con DeepSeek)
3. Genera 5 slide per ogni articolo valido
4. Le salva come JSON in `output/`
5. Le mostra come pagina scroll-snap su mobile

---

## Stack

- **Node.js** — runtime
- **DeepSeek API** (`deepseek-chat`) — AI filter + generazione slide
- **rss-parser** — lettura feed RSS
- **axios** — chiamate HTTP
- **md5** — hash per cache
- **dotenv** — variabili d'ambiente
- **HTML/CSS puro** — frontend scroll-snap, nessuna dipendenza esterna

---

## File principali

| File | Ruolo |
|---|---|
| `run.js` | Entry point — orchestra l'intera pipeline |
| `fetch.js` | Legge i feed RSS, restituisce `{ title, link, pubDate }[]` |
| `filter.js` | `deduplicate`, `hardFilter`, `batchAIFilter` |
| `deepseek.js` | Wrapper `callDeepSeek(prompt)` → stringa risposta |
| `generate.js` | `generateSlides(title)` → `{ title, slides[5] }`, con cache |
| `validate.js` | `isValid`, `validateWithFallback` con fallback su `review_queue.json` |
| `cache.json` | Cache persistente hash→slides (evita chiamate API duplicate) |
| `review_queue.json` | Articoli che non hanno superato la validazione dopo 2 tentativi |
| `output/` | File JSON generati dalla pipeline, uno per articolo |
| `frontend/index.html` | Pagina scroll-snap con 5 slide hardcoded (prototipo visivo) |

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
- Parse robusto con regex su risposta grezza (gestisce testo extra attorno al JSON)
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
- Flusso: fetch → dedup → hardFilter → batchAIFilter → validateWithFallback → salva JSON
- Output: `output/{{timestamp}}_{{slug}}.json`
- Riepilogo finale a console
- Risultato primo run: 32 fetched → 16 slide generate, 0 fallback

### M10 — Frontend scroll-snap ✅
- `frontend/index.html`: 5 slide hardcoded, CSS puro
- `scroll-snap-type: y mandatory`, ogni slide `100vh`
- Palette monocromatica slate (#0f172a → #475569)
- Testato su telefono via WSL2 port forwarding (`192.168.1.2:3000`)

---

## Milestones da fare

### M11 — Frontend dinamico (priorità assoluta)
- Leggere `output/*.json` e renderizzare le slide reali nel browser
- Approccio scelto: `run.js` scrive un file `frontend/data.js` statico (`window.ARTICLES = [...]`) che `index.html` importa con `<script src="data.js">`
- Nessun server HTTP richiesto — funziona anche da file locale
- Prerequisito per tutto il resto: il backend non serve a nulla se il formato non è visibile

### M12 — Cron + lock + logging
- Esecuzione autonoma di `run.js` ogni N ore
- Lock file per evitare doppie esecuzioni sovrapposte
- Log su `logs/run.log` per debug reale
- Attenzione: su Railway/Render con container che ripartono il lock può restare bloccato — valutare cron di piattaforma invece di lock custom
- Da fare DOPO il deploy, non prima

### M13 — Deploy
- Opzioni: Railway (più veloce), Render (cold start rompe cron su piano free), VPS Hetzner ~4$/mese (più controllo, cron di sistema)
- Deploy iniziale senza cron (solo `run.js` manuale) — aggiungere M12 dopo che gira in prod
- Obiettivo: endpoint pubblico per servire `frontend/index.html` e i JSON

### Ordine consigliato
M11 → M13 (deploy statico) → M12 (cron in prod)

---

## Note operative

- **Feed O'Reilly** (`feeds.feedburner.com/oreilly/radar`) restituisce 404 — ignorato, gli altri due funzionano
- **WSL2 port forwarding**: l'IP WSL2 cambia ad ogni riavvio; per riesporlo rieseguire:
  ```powershell
  netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=$(wsl hostname -I)
  ```
- **DeepSeek cost**: filtro AI + generazione slide per ~16 articoli consuma pochi centesimi per run
- **Cache**: dopo il primo run completo, le rigenerazioni sugli stessi titoli non costano nulla
