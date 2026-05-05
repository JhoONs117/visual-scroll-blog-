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

### M11 — Frontend dinamico ✅
- `run.js` al termine legge tutti i file in `output/` e scrive `frontend/data.js` con `window.ARTICLES = [...]`
- `index.html` importa `data.js` e renderizza le slide reali in JS puro
- Colori ciclano per gruppo di 5 slide con classi `.slide-color-0..4`
- Se `ARTICLES` è vuoto mostra "Nessun articolo disponibile"
- Nessun server richiesto — funziona anche da file locale

### M13 — Deploy ✅
- Deploy su Railway collegando il repo GitHub
- `npm start` esegue solo `node server.js` (il server parte in 1 secondo)
- Pipeline separata: `npm run pipeline` (`node run.js`) gira in locale
- Workflow aggiornamento contenuti: `node run.js` → `git push` → Railway rideploya automaticamente
- `DEEPSEEK_API_KEY` impostata come variabile d'ambiente in Railway (non nel `.env`)
- `server.js`: HTTP server minimale con Node built-in, nessuna dipendenza esterna, legge `PORT` da env

---

### M12 — Cron + scheduling ✅
- Cron installato su WSL con `crontab` direttamente da bash (evitato l'editor per problemi di copia)
- Esecuzione ogni 2 ore agli orari pari: `0 */2 * * * node run.js`
- Log salvati in `logs/run.log` (cartella esclusa dal `.gitignore`)
- Comando: `/home/miki/.nvm/versions/node/v22.22.2/bin/node /home/miki/visual-scroll-blog/run.js >> /home/miki/visual-scroll-blog/logs/run.log 2>&1`

---

## Progetto completato

Tutte le milestone M1–M13 sono complete. Il sistema gira in autonomia:
1. Il cron esegue `run.js` ogni 2 ore
2. `run.js` fetcha, filtra, genera slide e aggiorna `frontend/data.js`
3. Fai `git push` → Railway rideploya con i nuovi contenuti

---

## Note operative

- **Feed O'Reilly** (`feeds.feedburner.com/oreilly/radar`) restituisce 404 — ignorato, gli altri due funzionano
- **WSL2 port forwarding**: l'IP WSL2 cambia ad ogni riavvio; per riesporlo rieseguire:
  ```powershell
  netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=$(wsl hostname -I)
  ```
- **DeepSeek cost**: filtro AI + generazione slide per ~16 articoli consuma pochi centesimi per run
- **Cache**: dopo il primo run completo, le rigenerazioni sugli stessi titoli non costano nulla
