# Refactor Multi-Agente — Piano Operativo per Claude Code

Documento: guida step-by-step con prompt pronti e test per ogni fase.
Aggiornato: 2026-05-17 | Prerequisito: Food Agent STEP 1–8 completati ✅
Correlato a: PROJECT.md · MANUAL.md · FOOD-AGENT.md

> **Obiettivo finale:** il terzo agente (fitness) deve richiedere solo
> `agents/fitness/config.js` + `agents/fitness/prompts.js` + `agents/fitness/filters.js`.
> Nessun nuovo `run-*.js`, `fetch-*.js`, `generate-*.js`, `data-*.js`, `carousel-*.html`.

---

## Stato implementazione (2026-05-17)

| Fase | Stato | Note |
|---|---|---|
| FASE 0 — Baseline | ✅ Completa | `scripts/baseline.js` creato |
| FASE 1 — Schema v2 | ✅ Completa | Tutti i JSON migrati, alias legacy presenti |
| FASE 1B — Protezione backfill | ✅ Completa | `backfill.js`, `regenerate-all.js`, `backfill-carousel.js` skippano file v2 |
| FASE 2 — Cache split | ⏭ Saltata | `cache.json` mantiene prefissi (`food:*`, `ainews:*`, `md5`) — split non necessario in questa fase; runner unico usa path per-agente dalla config |
| FASE 3 — Registry agenti e canali | ✅ Completa | `agents/index.js`, `channels/index.js` |
| FASE 4 — Config agenti | ✅ Completa | `agents/ai-news/config.js`, `agents/food/config.js`, `agents/fitness/config.js` |
| FASE 5 — Runner unico | ✅ Completa | `core/run-agent.js` — orchestra AI news, food, fitness |
| FASE 6 — Migrazione food sul runner | ✅ Completa | Food gira su `core/run-agent.js` in CI |
| FASE 7 — Migrazione AI news sul runner | ✅ Completa | AI news gira su `core/run-agent.js` in CI |
| FASE 8 — Channel adapters | ✅ Completa | `channels/x.js`, `channels/instagram.js`, `channels/tiktok.js` |
| FASE 9 — Agente fitness | ✅ Completa | `agents/fitness/` completo, `output/fitness/`, in CI |
| FASE 10 — data-agents.js | ✅ Completa | `window.AGENTS = {ai-news, food, fitness}`, `scripts/build-data-agents.js` |
| FASE 11 — Review multi-canale | ✅ Completa | Badge agente, status pill, prompt_version, select X/IG/TikTok, copia per canale |
| FASE 12 — Automazione publish | 🔒 Bloccata | Meccanismo approvazione ✅ pronto (`POST /api/set-status` + tasto Approva in review.html + carousel.html). Sblocca con 30 `status: 'approved'`. |
| FASE 13 — Carousel unico | ✅ Completa | `carousel.html?agent=ai-news\|food`; proxy `/proxy-image` in `server.js` per food; `carousel-food.html` rimosso definitivamente |

---

## Regole non negoziabili (per tutto il refactor)

```
1. Non rompere mai AI news.
2. Se un agente fallisce, logga e continua — mai bloccare la pipeline principale.
3. Ogni fase è verificabile in isolamento prima di procedere alla successiva.
4. Non aggiungere fitness o altri agenti prima che FASE 7 sia stabile.
5. I JSON in output/ e output/food/ non vengono spostati finché non è esplicitamente previsto.
6. Il frontend (index.html, review.html, carousel.html) non viene
   toccato prima della FASE 10. [carousel-food.html rimosso in FASE 13]
```

---

## FASE 0 — Freeze + Baseline ✅

**Obiettivo:** fotografare lo stato attuale. Nessuna modifica al codice di produzione.
Tutto ciò che fai qui serve come confronto dopo ogni fase successiva.

### Prompt Claude Code

```
Crea il file scripts/baseline.js nella root del progetto.

Lo script deve:
1. Contare i file JSON in output/ (solo *.json, non ricorsivo)
2. Contare i file JSON in output/food/ (solo *.json)
3. Aprire cache.json e contare:
   - chiavi totali
   - chiavi che iniziano con "food:" (qualsiasi sottoprefisso)
   - chiavi che iniziano con "ainews:" (qualsiasi sottoprefisso)
   - chiavi che matchano /^[a-f0-9]{32}$/ (md5 puri — AI news slides/formats)
   - chiavi "unknown": tutto il resto (non food:, non ainews:, non md5 puro)
4. Stampare un riepilogo nel formato:

=== BASELINE ===
output/          : N articoli AI news
output/food/     : N articoli food
cache.json       : N chiavi totali
  food:*         : N
  ainews:*       : N
  md5 puri       : N
  unknown        : N (se > 0: lista le chiavi)
================

5. Se unknown > 0, stampare le chiavi unknown per ispezione manuale.
6. Salvare il riepilogo anche in scripts/baseline-snapshot.txt (sovrascrive ogni run).
2
Non modificare nessun altro file.
```

### Test manuali FASE 0

```bash
# Esegui baseline
node scripts/baseline.js

# Verifica che il totale batta
node -e "
const c = require('./cache.json');
const keys = Object.keys(c);
const food = keys.filter(k => k.startsWith('food:')).length;
const ainews = keys.filter(k => k.startsWith('ainews:')).length;
const md5 = keys.filter(k => /^[a-f0-9]{32}$/.test(k)).length;
const unknown = keys.length - food - ainews - md5;
console.log({total: keys.length, food, ainews, md5, unknown});
"

# Conta articoli
ls output/*.json 2>/dev/null | wc -l
ls output/food/*.json 2>/dev/null | wc -l
```

**Atteso:** `unknown === 0`. Se unknown > 0, ispeziona le chiavi prima di procedere —
potrebbero essere chiavi di test o formati non documentati che vanno categorizzati
prima dello split in FASE 2.

**Salva l'output di questo comando — è il tuo confronto per tutte le fasi successive.**

---

## FASE 1 — Schema v2 senza rompere legacy ✅

**Obiettivo:** definire e migrare allo schema v2. I vecchi campi restano come alias.
Nessuna modifica ai runner, nessuna modifica al frontend.

### Schema target

```json
{
  "schema_version": 2,
  "agent": "ai-news",
  "slug": "...",
  "title": "...",
  "link": "...",
  "pubDate": "...",
  "savedAt": "...",
  "image": "...",
  "prompt_version": "1.0.0",
  "status": "draft",

  "slides": ["...", "...", "...", "...", "..."],
  "carousel_slides": [],

  "formats": {
    "x": {
      "thread": ["...", "...", "...", "...", "..."]
    },
    "instagram": {
      "caption": "...",
      "carousel": []
    },
    "tiktok": {
      "script": ["...", "...", "...", "...", "..."]
    }
  },

  "thread_text": ["..."],
  "instagram_caption": "...",
  "video_script": ["..."],

  "metrics": {
    "x": {},
    "instagram": {},
    "tiktok": {}
  }
}
```

> **Alias legacy:** `thread_text`, `instagram_caption`, `video_script` restano nel JSON
> per 2 settimane come copia dei valori `formats.*`. Non sono campi calcolati — sono scritti
> entrambi al momento del salvataggio. Dopo la migrazione al runner unico (FASE 5–7),
> i nuovi articoli avranno solo i campi `formats.*` e gli alias potranno essere rimossi.

> **Campi opzionali per food:** `dish_type`, `signature_ingredients` restano a root
> come oggi — sono opzionali e il contract test non li richiede.

### Prompt Claude Code — schema docs

```
Crea il file docs/schema.md nella root del progetto.

Il file deve documentare lo schema JSON v2 per gli articoli del sistema.
Includi:
1. Tutti i campi con tipo, se obbligatorio o opzionale, e descrizione breve
2. I valori validi per "status": draft | approved | scheduled | published | failed
3. I valori validi per "agent": ai-news | food (per ora)
4. La regola degli alias legacy: thread_text = formats.x.thread, etc.
5. I campi opzionali per agente (es. dish_type e signature_ingredients solo per food)
6. La struttura di metrics (oggetto vuoto per ora, da riempire manualmente)
7. Un esempio JSON completo per AI news e uno per food

Non creare nessun altro file. Solo docs/schema.md.
```

### Prompt Claude Code — migration script

```
Crea il file scripts/migrate-schema.js nella root del progetto.

Lo script accetta un flag --dry-run o --apply come argomento (default: --dry-run).

Comportamento:

1. Legge tutti i file *.json in output/ e output/food/
2. Per ogni file:
   a. Se schema_version === 2: salta, logga "già v2: FILENAME"
   b. Se schema_version mancante o < 2: è un file v1 da migrare
3. Migrazione v1 → v2:
   - Aggiunge schema_version: 2
   - Aggiunge agent: inferito dalla directory ("ai-news" per output/, "food" per output/food/)
   - Aggiunge prompt_version: "1.0.0"
   - Aggiunge status: "draft"
   - Costruisce formats:
     formats.x.thread = thread_text (se presente, altrimenti [])
     formats.instagram.caption = instagram_caption (se presente, altrimenti "")
     formats.instagram.carousel = carousel_slides (se presente, altrimenti [])
     formats.tiktok.script = video_script (se presente, altrimenti [])
   - Mantiene thread_text, instagram_caption, video_script invariati (alias)
   - Aggiunge metrics: { x: {}, instagram: {}, tiktok: {} }
   - Mantiene tutti gli altri campi invariati (inclusi dish_type, signature_ingredients)
4. In --dry-run: stampa l'elenco dei file che verrebbero modificati e un diff dei campi
   aggiunti, senza scrivere nulla su disco.
5. In --apply: scrive i file modificati su disco (sovrascrive in-place),
   logga "migrato: FILENAME" per ogni file.
6. Alla fine stampa:
   - N file già v2 (saltati)
   - N file migrati (o da migrare in dry-run)
   - N errori (se un file non è JSON valido)

Non modificare nessun altro file.
```

### Prompt Claude Code — contract test

```
Crea il file scripts/contract-test.js nella root del progetto.

Lo script verifica che tutti i file JSON in output/ e output/food/ rispettino
il contratto v2. Non è un test sulle funzioni interne, ma sull'output finale salvato.

Contratto obbligatorio per ogni articolo:
- schema_version === 2
- agent: stringa non vuota
- slug: stringa non vuota
- title: stringa non vuota
- status: uno tra "draft" | "approved" | "scheduled" | "published" | "failed"
- slides: array di esattamente 5 stringhe non vuote
- carousel_slides: array di esattamente 5 oggetti (ognuno con hook e description)
- formats.x.thread: array di esattamente 5 stringhe non vuote
- formats.instagram.caption: stringa non vuota
- formats.tiktok.script: array di esattamente 5 stringhe non vuote

Contratto legacy (se presente deve essere consistente):
- Se thread_text è presente, deve essere identico a formats.x.thread
- Se instagram_caption è presente, deve essere identico a formats.instagram.caption
- Se video_script è presente, deve essere identico a formats.tiktok.script

Comportamento:
1. Legge tutti i *.json in output/ e output/food/
2. Per ogni file esegue tutti i controlli
3. Stampa per ogni file: PASS o FAIL con lista dei campi mancanti/errati
4. Alla fine: N pass, N fail
5. Exit code 1 se almeno un file fallisce, 0 se tutti passano

Non modificare nessun altro file.
```

### Test manuali FASE 1

```bash
# Dry-run prima di applicare
node scripts/migrate-schema.js --dry-run

# Ispeziona l'output — verifica che i campi siano corretti per
# almeno un articolo AI news e uno food prima di applicare
node scripts/migrate-schema.js --dry-run 2>&1 | head -80

# Applica
node scripts/migrate-schema.js --apply

# Verifica contratto su tutti i file
node scripts/contract-test.js

# Spot check manuale: apri un JSON AI news e uno food
node -e "
const fs = require('fs'), path = require('path');
const aiFile = fs.readdirSync('output').filter(f=>f.endsWith('.json')).sort().reverse()[0];
const foodFile = fs.readdirSync('output/food').filter(f=>f.endsWith('.json')).sort().reverse()[0];
const ai = JSON.parse(fs.readFileSync('output/'+aiFile));
const food = JSON.parse(fs.readFileSync('output/food/'+foodFile));
console.log('AI news schema_version:', ai.schema_version);
console.log('AI news agent:', ai.agent);
console.log('AI news formats.x.thread length:', ai.formats?.x?.thread?.length);
console.log('AI news alias thread_text === formats.x.thread:',
  JSON.stringify(ai.thread_text) === JSON.stringify(ai.formats?.x?.thread));
console.log('---');
console.log('Food schema_version:', food.schema_version);
console.log('Food agent:', food.agent);
console.log('Food dish_type:', food.dish_type);
console.log('Food formats.instagram.caption length:', food.formats?.instagram?.caption?.length);
"

# Ri-esegui baseline — i conteggi devono essere identici
node scripts/baseline.js
```

**Atteso:** `contract-test.js` stampa solo PASS. Conteggi baseline invariati.

---

## FASE 1B — Protezione backfill legacy ✅

**Obiettivo:** impedire che `backfill.js`, `regenerate-all.js`, `backfill-carousel.js`
sovrascrivano file v2 con output v1 durante la transizione.

### Prompt Claude Code

```
Modifica i file backfill.js, regenerate-all.js e backfill-carousel.js.

Per ognuno, aggiungi questo controllo prima di qualsiasi scrittura su un file JSON:

1. Quando lo script legge un file JSON esistente da output/ o output/food/,
   controlla se article.schema_version === 2
2. Se schema_version === 2:
   - Stampa un warning: "⚠️  SKIP [FILENAME] — schema v2 (usa migrate-schema.js o il nuovo runner)"
   - Salta il file senza modificarlo
3. Se schema_version è assente o < 2:
   - Procedi normalmente come prima

Non modificare la logica di nessun altro file.
Non modificare il comportamento per i file v1.
Il warning deve andare su stderr, non stdout, per non sporcare i log strutturati.
```

### Test manuali FASE 1B

```bash
# Verifica che backfill.js salti i file v2
# Prima esegui migrate-schema.js --apply (FASE 1), poi:
node backfill.js 2>&1 | grep "SKIP" | head -5

# Atteso: una riga SKIP per ogni articolo già migrato a v2
# Nessun file v2 deve essere sovrascritto

# Verifica che l'output di output/ non sia cambiato dopo backfill.js
node scripts/contract-test.js
```

---

## FASE 2 — Cache split ⏭ (saltata)

> **Nota (2026-05-17):** questa fase è stata saltata. `cache.json` mantiene la struttura
> con prefissi per agente (`food:*`, `ainews:*`, `md5 puri`). Le config degli agenti in
> FASE 4 dichiarano il `cacheFile` per-agente, ma in pratica i runner legacy (`run.js`,
> `run-food.js`) usano ancora `cache.json`. Lo split può essere fatto in futuro se
> si vuole parallelizzare i runner — non è urgente con il cron sequenziale attuale.

**Obiettivo originale:** dividere `cache.json` in `cache/ai-news.json` e `cache/food.json`.
Dopo questo step i runner possono girare in parallelo senza write conflict.

### Prompt Claude Code — split script

```
Crea il file scripts/split-cache.js nella root del progetto.

Lo script accetta --dry-run o --apply (default: --dry-run).

Logica di categorizzazione delle chiavi:
- Chiavi food: iniziano con "food:" (qualsiasi sottoprefisso)
- Chiavi ainews caption: iniziano con "ainews:"
- Chiavi md5 puri: matchano esattamente /^[a-f0-9]{32}$/ — sono slides/formats AI news
- Chiavi unknown: tutto il resto

Comportamento:
1. Legge cache.json
2. Categorizza ogni chiave secondo la logica sopra
3. Se unknown > 0: stampa le chiavi unknown e termina con exit code 1,
   senza scrivere nulla. Il blocco è intenzionale — le chiavi sconosciute
   vanno ispezionate manualmente e aggiunte a una categoria prima di procedere.
4. In --dry-run: stampa il piano di split (N chiavi → cache/ai-news.json,
   N chiavi → cache/food.json) senza scrivere nulla.
5. In --apply:
   a. Crea la directory cache/ se non esiste
   b. Scrive cache/ai-news.json con le chiavi ainews: + md5 puri
   c. Scrive cache/food.json con le chiavi food:
   d. NON elimina cache.json (backup automatico — da eliminare manualmente dopo verifica)
   e. Logga: "cache/ai-news.json: N chiavi" e "cache/food.json: N chiavi"

Non modificare nessun altro file.
```

### Prompt Claude Code — aggiornamento run.js e run-food.js

```
Modifica run.js per leggere e scrivere cache/ai-news.json invece di cache.json.

Regole:
1. Cerca tutte le occorrenze di 'cache.json' in run.js
2. Sostituiscile con path.join(__dirname, 'cache', 'ai-news.json')
3. Assicurati che la directory cache/ esista prima di ogni scrittura
   (usa fs.mkdirSync(cacheDir, { recursive: true }) all'inizio del file)
4. Non modificare nessun'altra logica — solo il path della cache

Poi modifica run-food.js allo stesso modo:
1. Sostituisci 'cache.json' con path.join(__dirname, 'cache', 'food.json')
2. Stessa protezione mkdirSync

Non modificare nessun altro file.
```

### Test manuali FASE 2

```bash
# Dry-run split
node scripts/split-cache.js --dry-run

# Verifica che i conteggi battano con baseline
# es. se baseline aveva food:120, ainews:74, md5:800
# allora cache/food.json deve avere 120 chiavi, cache/ai-news.json 874

# Applica split
node scripts/split-cache.js --apply

# Verifica i file prodotti
node -e "
const aiCache = require('./cache/ai-news.json');
const foodCache = require('./cache/food.json');
console.log('ai-news cache keys:', Object.keys(aiCache).length);
console.log('food cache keys:', Object.keys(foodCache).length);
// Verifica che non ci siano chiavi food in ai-news e viceversa
const foodInAI = Object.keys(aiCache).filter(k => k.startsWith('food:'));
const aiInFood = Object.keys(foodCache).filter(k => !k.startsWith('food:'));
console.log('chiavi food in ai-news (deve essere 0):', foodInAI.length);
console.log('chiavi non-food in food (deve essere 0):', aiInFood.length);
"

# Test run.js con nuova cache (usa MAX_NEW_ARTICLES=0 per non processare nuovi articoli)
MAX_NEW_ARTICLES=0 node run.js
# Atteso: "0 nuovi articoli" + nessun errore ENOENT su cache

# Test run-food.js con nuova cache
MAX_NEW_FOOD_ARTICLES=0 node run-food.js
# Atteso: "0 nuovi articoli food" + nessun errore ENOENT su cache

# Ri-esegui contract test — niente deve essere cambiato
node scripts/contract-test.js

# Solo dopo verifica completa, rimuovi cache.json legacy
# rm cache.json
# (non farlo ora — tienila come backup per qualche giorno)
```

---

## FASE 3 — Registry agenti e canali ✅

**Obiettivo:** creare i registry come unico punto di registrazione.
Nessun codice di produzione cambia — solo struttura dichiarativa.

### Prompt Claude Code

```
Crea i seguenti file:

1. agents/index.js

Contenuto:
'use strict';
module.exports = {
  'ai-news': require('./ai-news/config'),
  'food': require('./food/config'),
};

Crea la directory agents/ se non esiste.
Non creare ancora agents/ai-news/config.js né agents/food/config.js —
quelli vengono creati in FASE 4.

2. channels/index.js

Contenuto:
'use strict';
module.exports = {
  x: require('./x'),
  instagram: require('./instagram'),
  tiktok: require('./tiktok'),
};

Crea la directory channels/ se non esiste.
Non creare ancora channels/x.js, channels/instagram.js, channels/tiktok.js —
quelli vengono creati in FASE 8.
Commenta i tre require per ora (o usa try/catch con warning) in modo che
il registry non esploda in FASE 3 quando i moduli non esistono ancora.

Non modificare nessun altro file.
```

### Test manuali FASE 3

```bash
# Verifica che i registry si carichino senza errori
node -e "const agents = require('./agents/index'); console.log('agents registry OK, keys:', Object.keys(agents))"
# Atteso: agents registry OK, keys: [] (vuoto — le config non esistono ancora)

node -e "const channels = require('./channels/index'); console.log('channels registry OK, keys:', Object.keys(channels))"
# Atteso: channels registry OK, keys: [] (vuoto — i moduli non esistono ancora)
```

---

## FASE 4 — Config agenti ✅

**Obiettivo:** estrarre la configurazione specifica di ogni agente in un file dichiarativo.
I runner originali (`run.js`, `run-food.js`) non vengono toccati in questa fase.

### Prompt Claude Code — config AI news

```
Crea il file agents/ai-news/config.js.

Il file deve esportare un oggetto di configurazione per l'agente AI news.
Importa le funzioni esistenti dai file originali — non duplicare il codice.

La config deve contenere:
- id: 'ai-news'
- label: 'AI News'
- emoji: '⚡'
- outputDir: path.join(__dirname, '../../output')
- cacheFile: path.join(__dirname, '../../cache/ai-news.json')
- reviewQueueFile: path.join(__dirname, '../../review_queue.json')
- maxNewEnv: 'MAX_NEW_ARTICLES'
- promptVersion: '1.0.0'

- feeds: array con gli stessi 3 feed RSS di fetch.js

- gate: null (AI news non ha gate — passa tutto il hardFilter)
- aiFilter: riferimento a batchAIFilter importato da filter.js

- theme:
  badge: 'AI NEWS'
  className: ''
  handle: '@FlashAI'
  palette:
    accent: '#3b82f6'
    badgeBg: '#2563eb'

- steps: array di stringhe che definisce la pipeline nell'ordine:
  ['fetch', 'hardFilter', 'aiFilter', 'generateSlides', 'generateFormats',
   'generateCaption', 'generateCarousel', 'fetchImages', 'validate', 'save', 'buildData']

- channels: ['x', 'instagram', 'tiktok']

- prompts: oggetto con riferimenti alle funzioni di generate.js:
  slides: generateSlides
  formats: generateFormats
  carousel: generateCarouselSlides
  caption: generateAINewsCaption

Non modificare nessun altro file.
Non eseguire nessun codice — il file è solo configurazione.
```

### Prompt Claude Code — config food

```
Crea il file agents/food/config.js.

Il file deve esportare un oggetto di configurazione per l'agente food.
Importa le funzioni esistenti dai file originali — non duplicare il codice.

La config deve contenere:
- id: 'food'
- label: '5 Step Food'
- emoji: '🍳'
- outputDir: path.join(__dirname, '../../output/food')
- cacheFile: path.join(__dirname, '../../cache/food.json')
- reviewQueueFile: null (food non ha review queue)
- maxNewEnv: 'MAX_NEW_FOOD_ARTICLES'
- promptVersion: '1.0.0'

- feeds: ['https://www.giallozafferano.it/feed']

- gate: looksLikeRecipe importato da fetch-food.js
- aiFilter: null (food non usa batchAIFilter)

- theme:
  badge: '5 STEP FOOD'
  className: 'food-story'
  handle: '@FlashKitchen'
  palette:
    accent: '#e07b39'
    badgeBg: '#3d5a3e'

- extraFields: ['dish_type', 'signature_ingredients']

- steps: array di stringhe:
  ['fetch', 'enrich', 'gate', 'generateSlides', 'generateCaption',
   'generateVideoScript', 'generateThread', 'generateCarousel', 'fetchImages', 'save', 'buildData']

- channels: ['x', 'instagram', 'tiktok']

- prompts: oggetto con riferimenti alle funzioni di generate-food.js:
  slides: generateRecipeSlides
  carousel: generateRecipeCarouselSlides
  caption: generateFoodCaption
  videoScript: generateFoodVideoScript
  thread: generateFoodThread

Non modificare nessun altro file.
Non eseguire nessun codice — il file è solo configurazione.
```

### Prompt Claude Code — aggiorna registry

```
Ora che le config esistono, aggiorna agents/index.js per caricarle correttamente.

Sostituisci il contenuto di agents/index.js con:

'use strict';
module.exports = {
  'ai-news': require('./ai-news/config'),
  'food': require('./food/config'),
};

Non modificare nessun altro file.
```

### Test manuali FASE 4

```bash
# Verifica che le config si carichino
node -e "
const agents = require('./agents/index');
console.log('Agenti registrati:', Object.keys(agents));
const ai = agents['ai-news'];
const food = agents['food'];
console.log('AI news id:', ai.id, '| feeds:', ai.feeds.length, '| steps:', ai.steps.length);
console.log('Food id:', food.id, '| feeds:', food.feeds.length, '| gate:', typeof food.gate);
console.log('AI news prompts:', Object.keys(ai.prompts));
console.log('Food prompts:', Object.keys(food.prompts));
"

# Verifica che le funzioni importate siano effettivamente funzioni
node -e "
const ai = require('./agents/ai-news/config');
const food = require('./agents/food/config');
console.log('ai.prompts.slides è funzione:', typeof ai.prompts.slides === 'function');
console.log('food.prompts.slides è funzione:', typeof food.prompts.slides === 'function');
console.log('food.gate è funzione:', typeof food.gate === 'function');
console.log('ai.aiFilter è funzione:', typeof ai.aiFilter === 'function');
"

# I runner originali devono ancora funzionare invariati
MAX_NEW_ARTICLES=0 node run.js
MAX_NEW_FOOD_ARTICLES=0 node run-food.js
```

---

## FASE 5 — Runner unico a step opzionali ✅

**Obiettivo:** creare `core/run-agent.js`. Il runner non conosce AI news o food —
orchestra solo i step dichiarati nella config.

### Prompt Claude Code

```
Crea il file core/run-agent.js.

Il runner accetta un config object (da agents/index.js) e lo esegue.

Struttura della pipeline (step opzionali — se non presenti nella config, vengono saltati):

async function runAgent(config) {
  // 1. Leggi MAX_NEW da env
  const maxNew = parseInt(process.env[config.maxNewEnv] || '3', 10);

  // 2. Carica cache
  const cache = loadCache(config.cacheFile);  // legge JSON, {} se non esiste

  // 3. Esegui la pipeline per ogni articolo candidato
  // La pipeline è una sequenza di step. Ogni step è una funzione asincrona
  // che riceve (article, config, cache) e restituisce l'articolo modificato,
  // oppure null per scartarlo (skip).

  // Step disponibili (tutti opzionali — il runner li chiama solo se la config li dichiara in steps[]):
  //
  // 'fetch'           → chiama config.fetchFn() — restituisce array di {title,slug,link,pubDate,content}
  // 'hardFilter'      → applica hardFilter da filter.js (solo AI news)
  // 'aiFilter'        → chiama config.aiFilter() se presente
  // 'gate'            → chiama config.gate(article) se presente — restituisce bool
  // 'enrich'          → chiama config.enrichFn(article) se presente (es. fetchArticleContent per food)
  // 'generateSlides'  → chiama config.prompts.slides(article, cache)
  // 'generateFormats' → chiama config.prompts.formats(article, cache) se presente
  // 'generateCaption' → chiama config.prompts.caption(article, cache)
  // 'generateVideoScript' → chiama config.prompts.videoScript(article, cache) se presente
  // 'generateThread'  → chiama config.prompts.thread(article, cache) se presente
  // 'generateCarousel'→ chiama config.prompts.carousel(article, cache)
  // 'fetchImages'     → chiama fetchPexelsImage + fetchArticleImage da fetch.js/images.js
  // 'validate'        → chiama validateWithFallback se presente nella config
  // 'save'            → scrive il JSON in config.outputDir con schema_version:2
  // 'buildData'       → scrive il data file (config.dataFile)

  // 4. Ogni step deve:
  //    - loggare l'inizio ("→ [agentId] step: X")
  //    - essere wrapped in try/catch: se lo step fallisce per un articolo,
  //      loga il warning e scarta l'articolo (non blocca il run)
  //    - rispettare maxNew: fermati quando hai salvato abbastanza articoli nuovi

  // 5. Alla fine logga il riepilogo:
  //    "[agentId] completato: N nuovi | N da cache | N scartati"
}

// Entry point da CLI: node core/run-agent.js ai-news
if (require.main === module) {
  const agentId = process.argv[2];
  if (!agentId) { console.error('Uso: node core/run-agent.js <agentId>'); process.exit(1); }
  const agents = require('../agents/index');
  const config = agents[agentId];
  if (!config) { console.error('Agente non trovato:', agentId); process.exit(1); }
  runAgent(config).catch(err => { console.error('Errore fatale:', err); process.exit(1); });
}

module.exports = { runAgent };

Nota: in questa fase NON aggiornare pipeline.yml e NON rimuovere run.js o run-food.js.
Il runner unico esiste ma non è ancora in produzione.
```

### Test manuali FASE 5

```bash
# Verifica che il file si carichi senza errori
node -e "require('./core/run-agent'); console.log('run-agent caricato OK')"

# Verifica che il CLI funzioni con un agente noto
node core/run-agent.js --help 2>&1 || true
# Atteso: stampa "Uso: node core/run-agent.js <agentId>" senza stack trace

# Verifica che un agente inesistente fallisca con messaggio leggibile
node core/run-agent.js nonexistent 2>&1
# Atteso: "Agente non trovato: nonexistent"

# I runner originali devono ancora funzionare — non sono stati toccati
MAX_NEW_ARTICLES=0 node run.js
MAX_NEW_FOOD_ARTICLES=0 node run-food.js
```

---

## FASE 6 — Migrazione food sul runner unico ✅

**Obiettivo:** far girare il food agent attraverso `core/run-agent.js`.
`output/food/` e `data-food.js` restano invariati. Il frontend non cambia.

> **Perché food prima:** è più isolato (nessun review_queue, nessun batchAIFilter,
> output directory separata). Se qualcosa va storto, non impatta AI news.

### Prompt Claude Code

```
Completa la migrazione del food agent su core/run-agent.js.

1. Aggiorna agents/food/config.js per aggiungere tutti i dettagli necessari
   al runner: fetchFn, enrichFn, dataFile path, e qualsiasi altra funzione
   che run-food.js usa oggi e che il runner deve poter chiamare.

2. Verifica che core/run-agent.js gestisca correttamente questi step food:
   - 'enrich': chiama fetchArticleContent(article.link) e aggiunge article.content
   - 'gate': chiama looksLikeRecipe(article) e scarta se restituisce false
   - 'generateVideoScript' e 'generateThread': step separati (food non usa generateFormats)

3. Scrivi uno script di verifica scripts/verify-food-migration.js che:
   - Esegue MAX_NEW_FOOD_ARTICLES=1 node core/run-agent.js food
   - Legge l'articolo generato
   - Verifica che il JSON rispetti il contract (chiama contract-test.js internamente)
   - Confronta i campi chiave con un articolo food esistente (generato da run-food.js)
     per assicurarsi che la struttura sia identica
   - Stampa: PASS o FAIL con dettagli

Non modificare run-food.js — deve restare funzionante.
Non modificare il frontend.
```

### Test manuali FASE 6

```bash
# Test con 1 solo articolo — non usa cache quindi chiama l'API
MAX_NEW_FOOD_ARTICLES=1 node core/run-agent.js food

# Verifica il JSON generato
LAST=$(ls -t output/food/*.json | head -1)
node -e "
const a = require('./$LAST'); // aggiusta il path se necessario
console.log('schema_version:', a.schema_version);  // deve essere 2
console.log('agent:', a.agent);                     // deve essere 'food'
console.log('slides:', a.slides?.length);           // deve essere 5
console.log('formats.x.thread:', a.formats?.x?.thread?.length); // deve essere 5
console.log('formats.instagram.caption:', a.formats?.instagram?.caption?.slice(0,50));
console.log('formats.tiktok.script:', a.formats?.tiktok?.script?.length); // deve essere 5
console.log('carousel_slides:', a.carousel_slides?.length); // deve essere 5
"

# Contract test su tutti i file (incluso il nuovo)
node scripts/contract-test.js

# Ri-esegui baseline — output/food/ deve avere 1 file in più
node scripts/baseline.js

# run-food.js deve ancora funzionare invariato
MAX_NEW_FOOD_ARTICLES=0 node run-food.js
```

**Solo dopo che `verify-food-migration.js` stampa PASS per almeno 3 articoli consecutivi:**
aggiungi `node core/run-agent.js food` a `pipeline.yml` come alternativa a `run-food.js`
(non sostituirlo ancora — fallo girare in parallelo per una settimana).

---

## FASE 7 — Migrazione AI news sul runner unico ✅

**Obiettivo:** far girare AI news attraverso `core/run-agent.js`.
`output/` e `data.js` restano invariati. `review_queue.json` resta supportata.

### Prompt Claude Code

```
Completa la migrazione dell'AI news agent su core/run-agent.js.

1. Aggiorna agents/ai-news/config.js per aggiungere:
   - fetchFn: funzione che chiama fetchArticles() da fetch.js
   - dataFile: path.join(__dirname, '../../frontend/data.js')
   - reviewQueueWriter: funzione che scrive su review_queue.json (stessa logica di run.js)
   - la logica di deduplicazione cross-run (leggi slug esistenti da output/ prima del fetch)

2. Verifica che core/run-agent.js gestisca:
   - 'hardFilter': chiama hardFilter da filter.js
   - 'aiFilter': chiama batchAIFilter da filter.js
   - 'validate': chiama validateWithFallback e scrive su reviewQueueFile se fallisce

3. Scrivi scripts/verify-ai-migration.js — stessa struttura di verify-food-migration.js
   ma confronta con un articolo AI news esistente.

Non modificare run.js — deve restare funzionante.
Non modificare il frontend.
Non modificare pipeline.yml ancora.
```

### Test manuali FASE 7

```bash
# Test con 1 articolo
MAX_NEW_ARTICLES=1 node core/run-agent.js ai-news

# Verifica JSON
LAST=$(ls -t output/*.json | head -1)
node -e "
const fs = require('fs');
const a = JSON.parse(fs.readFileSync('$LAST'));
console.log('schema_version:', a.schema_version);
console.log('agent:', a.agent);
console.log('slides:', a.slides?.length);
console.log('formats.x.thread:', a.formats?.x?.thread?.length);
console.log('instagram_caption alias OK:',
  a.instagram_caption === a.formats?.instagram?.caption);
"

# Contract test completo
node scripts/contract-test.js

# Baseline invariato tranne +1 in output/
node scripts/baseline.js

# run.js deve ancora funzionare
MAX_NEW_ARTICLES=0 node run.js
```

### Aggiornamento pipeline.yml — solo dopo verifica

```yaml
# Sostituisci il passo attuale con:
- name: Run AI news agent
  run: node core/run-agent.js ai-news
  env:
    DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
    PEXELS_API_KEY: ${{ secrets.PEXELS_API_KEY }}
    MAX_NEW_ARTICLES: '4'

- name: Run food agent
  run: node core/run-agent.js food || echo "Food pipeline failed, continuing"
  env:
    DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
    PEXELS_API_KEY: ${{ secrets.PEXELS_API_KEY }}
    MAX_NEW_FOOD_ARTICLES: '3'
```

> **Non aggiornare pipeline.yml finché entrambi gli script verify-* non stampano PASS
> per almeno 3 run consecutivi in locale.**

---

## FASE 8 — Channel adapters comuni ✅

**Obiettivo:** separare "generare contenuto" da "formattarlo per un canale".
Gli agenti producono contenuto base. I canali normalizzano in `formats.*`.

> **Nota:** questa fase non blocca FASE 9. Puoi aggiungere fitness con funzioni
> di generazione dirette nella config e aggiungere i channel adapters dopo.

### Prompt Claude Code

```
Crea i file channels/x.js, channels/instagram.js, channels/tiktok.js.

channels/x.js:
Esporta una funzione adapt(article) che restituisce article con:
- formats.x.thread garantito (se mancante, usa thread_text come fallback, altrimenti [])
- formats.x.thread normalizzato: array di esattamente 5 stringhe

channels/instagram.js:
Esporta una funzione adapt(article) che restituisce article con:
- formats.instagram.caption garantito (string, '' se mancante)
- formats.instagram.carousel garantito (array, usa carousel_slides come fallback)

channels/tiktok.js:
Esporta una funzione adapt(article) che restituisce article con:
- formats.tiktok.script garantito (array di 5 stringhe, usa video_script come fallback)

Aggiorna channels/index.js per importare i tre moduli reali
(rimuovi i commenti/try-catch provvisori di FASE 3).

Non modificare il runner né le config degli agenti.
```

### Test manuali FASE 8

```bash
# Verifica che gli adapter si carichino
node -e "
const channels = require('./channels/index');
console.log('Canali:', Object.keys(channels));
"

# Verifica su un articolo reale
node -e "
const fs = require('fs');
const channels = require('./channels/index');
const file = fs.readdirSync('output').filter(f=>f.endsWith('.json')).sort().reverse()[0];
const article = JSON.parse(fs.readFileSync('output/'+file));
const adapted = channels.x.adapt(article);
console.log('thread dopo adapt:', adapted.formats.x.thread?.length, 'tweet');
const adapted2 = channels.instagram.adapt(article);
console.log('caption dopo adapt:', adapted2.formats.instagram.caption?.slice(0,50));
"
```

---

## FASE 9 — Aggiunta agente fitness ✅

**Prerequisiti prima di iniziare questa fase:**
- food gira su `core/run-agent.js` in produzione da almeno 1 settimana ✓
- ai-news gira su `core/run-agent.js` in produzione da almeno 3 giorni ✓
- `scripts/contract-test.js` passa su tutti gli articoli esistenti ✓
- `cache/ai-news.json` e `cache/food.json` stabili ✓

### Struttura richiesta per fitness

```
agents/
  fitness/
    config.js     ← configurazione agente
    prompts.js    ← funzioni di generazione specifiche fitness
    filters.js    ← gate e filtri specifici fitness
```

### Prompt Claude Code

```
Crea l'agente fitness seguendo esattamente la struttura del food agent.

1. agents/fitness/filters.js
   - WHITELIST fitness: ['allenamento', 'workout', 'esercizio', 'fitness', 'palestra',
     'corsa', 'running', 'yoga', 'pilates', 'stretching', 'muscoli', 'dimagrire',
     'cardio', 'forza', 'resistenza']
   - Funzione looksLikeFitnessContent(article): restituisce true se il titolo contiene
     almeno una parola della whitelist (case insensitive)
   - Esporta: { looksLikeFitnessContent, FITNESS_WHITELIST }

2. agents/fitness/prompts.js
   - generateFitnessSlides(article, cache): 5 slide per un workout/esercizio
     formato: 1 hook motivazionale | 2 contesto/beneficio | 3 tecnica chiave |
     4 errore comune da evitare | 5 call to action pratica
   - generateFitnessCarouselSlides(article, cache): stesso schema di generateRecipeCarouselSlides
     ma con tematiche fitness (immagini di persone che si allenano, attrezzatura, ambienti)
   - generateFitnessCaption(article, cache): caption Instagram in stile motivazionale
   - generateFitnessVideoScript(article, cache): 5 righe parlate per reel fitness
   - generateFitnessThread(article, cache): 5 tweet stile coaching pratico
   Usa callDeepSeek da deepseek.js. Implementa cache con prefisso 'fitness:'.

3. agents/fitness/config.js
   Stessa struttura di agents/food/config.js con:
   - id: 'fitness'
   - label: 'Flash Fitness'
   - emoji: '💪'
   - outputDir: 'output/fitness'
   - cacheFile: 'cache/fitness.json'
   - maxNewEnv: 'MAX_NEW_FITNESS_ARTICLES'
   - feeds: ['https://www.gazzetta.it/rss/fitness.xml']  (o feed da verificare)
   - gate: looksLikeFitnessContent
   - theme: palette giallo/nero (scegli tu colori coerenti)

4. Aggiorna agents/index.js aggiungendo:
   'fitness': require('./fitness/config')

5. Crea output/fitness/.gitkeep e cache/fitness.json (oggetto vuoto {})

Non modificare run.js, run-food.js, core/run-agent.js, né il frontend.
```

### Test manuali FASE 9

```bash
# Verifica registry aggiornato
node -e "const a = require('./agents/index'); console.log(Object.keys(a))"
# Atteso: [ 'ai-news', 'food', 'fitness' ]

# Test con 1 articolo
MAX_NEW_FITNESS_ARTICLES=1 node core/run-agent.js fitness

# Contract test (include il nuovo articolo fitness)
node scripts/contract-test.js

# Baseline aggiornato
node scripts/baseline.js

# Aggiunta a pipeline.yml (stesso pattern di food):
# - name: Run fitness agent
#   run: node core/run-agent.js fitness || echo "Fitness pipeline failed, continuing"
#   env:
#     MAX_NEW_FITNESS_ARTICLES: '3'
```

---

## FASE 10 — data-agents.js (commit atomico) ✅

**Obiettivo:** unificare `data.js` e `data-food.js` in `window.AGENTS`.
**Questo commit deve toccare esattamente questi file in una sola operazione:**
`scripts/build-data-agents.js` + `frontend/index.html` + `frontend/review.html`.

### Prompt Claude Code

```
Crea scripts/build-data-agents.js.

Lo script:
1. Legge tutti i JSON da output/ (AI news), output/food/, output/fitness/
   con la stessa logica di deduplicazione per slug (file più recente per slug)
2. Produce window.AGENTS:
   {
     "ai-news": [ ...articoli ordinati per savedAt desc ],
     "food": [ ...articoli ordinati per savedAt desc ],
     "fitness": [ ...articoli ordinati per savedAt desc ]
   }
3. Scrive frontend/data-agents.js con:
   window.AGENTS = { ... };
4. Logga: "data-agents.js aggiornato: N ai-news | N food | N fitness"

Poi aggiorna frontend/index.html:
- Rimuovi il caricamento di data.js e data-food.js via script injection
- Aggiungi <script src="data-agents.js"></script>
- Sostituisci window.ARTICLES con window.AGENTS['ai-news']
  e window.FOOD_ARTICLES con window.AGENTS['food']
  nei punti in cui vengono letti
- Aggiungi il support a window.AGENTS['fitness'] nel select agente

Poi aggiorna frontend/review.html con la stessa logica.

Non modificare carousel.html né carousel-food.html — quelli vengono aggiornati in FASE 13.
```

### Test manuali FASE 10

```bash
# Genera il file
node scripts/build-data-agents.js

# Verifica
node -e "
// Simula window
global.window = {};
require('./frontend/data-agents.js');
console.log('Agenti:', Object.keys(window.AGENTS));
console.log('AI news:', window.AGENTS['ai-news']?.length, 'articoli');
console.log('Food:', window.AGENTS['food']?.length, 'articoli');
console.log('Fitness:', window.AGENTS['fitness']?.length, 'articoli');
"

# Test visivo: apri il sito in locale
node server.js &
open http://localhost:3000
# Verifica manualmente che il feed mostri articoli per tutti e 3 gli agenti

# Contract test invariato
node scripts/contract-test.js
```

---

## FASE 11 — Review multi-canale ✅

**Obiettivo:** aggiornare `review.html` per mostrare agente, canale, status, prompt_version.

### Prompt Claude Code

```
Aggiorna frontend/review.html per mostrare i nuovi campi schema v2.

Per ogni articolo mostra:
- Badge agente (da article.agent) con colore dal theme
- Status pill: draft | approved | published (con colore diverso per stato)
- prompt_version in piccolo grigio
- Sezioni contenuto organizzate per canale:
  X/Twitter: formats.x.thread
  Instagram: formats.instagram.caption + anteprima carousel_slides
  TikTok: formats.tiktok.script
- Il tasto "Copia tutto" deve copiare il formato del canale selezionato
- Aggiungi un select canale (X / Instagram / TikTok) che mostra il contenuto corrispondente

Mantieni la compatibilità con gli alias legacy (thread_text, etc.) per i file v1 eventualmente presenti.
Non modificare carousel.html né carousel-food.html.
```

### Test manuali FASE 11

```bash
# Apri review.html e verifica manualmente:
# 1. Badge agente visibile per AI news e food
# 2. Status "draft" visibile
# 3. Switch canale funzionante (X / Instagram / TikTok)
# 4. Copia tasto funzionante per ogni canale
# 5. prompt_version visibile
open http://localhost:3000/review.html
```

---

## FASE 12 — Media Pipeline & Autonomous Publishing 🔒 (bloccata)

**Prerequisito hard:** almeno 30 articoli con `status: 'approved'` impostato
manualmente da `review.html` o `carousel.html`. Il dato è più importante dell'automazione.
Non iniziare questa fase prima.

**Meccanismo approvazione — già implementato (2026-05-17):**
- `POST /api/set-status` in `server.js` — trova il JSON per `article.slug`, scrive `status`, rilancia `build-data-agents.js` in background
- `review.html` — tasto Approva per ogni articolo + barra progresso `X/30 approvati`
- `carousel.html` — status pill + tasto Approva nella barra DL + contatore `X/30 approvati` nella selector bar + `✅` emoji nel dropdown per articoli approvati
- **Flusso di salvataggio:** approva in locale → `git add output/ && git commit && git push` → Railway rideploya con gli status dal repo (il filesystem Railway è effimero)

---

### 12.0 — Prerequisiti tecnici

Prima di scrivere una riga di codice, verifica tutto questo:

```bash
# 1. ffmpeg disponibile in locale
ffmpeg -version
# Atteso: versione >= 4.x

# 2. drawtext disponibile (richiede libfreetype — non sempre compilato)
ffmpeg -filters 2>&1 | grep drawtext
# Atteso: "drawtext" nella lista
# Se assente: i sottotitoli non funzioneranno — installa ffmpeg con libfreetype

# 3. ffprobe disponibile (per verifica finale video)
ffprobe -version

# 4. Font incluso nel repo per consistenza locale/CI
# Aggiungere: assets/fonts/Inter-Bold.ttf
# Non usare mai font di sistema — il path diverge tra macOS e Linux CI

# 5. Verificare che renders/ sia escluso da git e Railway
grep "renders" .gitignore        # deve esserci output/*/renders/
grep "renders" .railwayignore    # deve esserci output/*/renders/
```

**GitHub Actions** richiede uno step dedicato:
```yaml
- name: Install ffmpeg
  run: sudo apt-get install -y ffmpeg
```
Aggiungere a `.github/workflows/pipeline.yml` solo quando la FASE 12 è pronta
per CI — non prima.

**Scelta TTS (decidere prima di V1):**

| Provider | Costo | Qualità | wpm stimato |
|---|---|---|---|
| OpenAI TTS | ~$0.015/1K chars | buona | ~130 wpm |
| ElevenLabs | ~$0.30/1K chars | ottima | ~120 wpm |

La scelta impatta `estimateDuration()` — il divisore cambia.
Hardcodare il provider nella config dell'agente: `ttsProvider: 'openai'`.

**`.gitignore` e `.railwayignore`** — aggiungere subito, prima di qualsiasi render:
```
# Video renders — mai committare mp4
output/*/renders/
output/renders/
```

**Formato export fisso:** `1080×1920` (9:16), H264, max 50MB per TikTok.
Nessuna eccezione — mp4 più grandi vengono rifiutati dall'upload API.

---

### 12.1 — Principi architetturali

```
1. Gli agenti NON conoscono i canali.
2. I canali NON conoscono gli agenti.
3. Il contenuto base è unico — video_scenes sta a root dell'articolo, non in formats.
4. Gli adapter trasformano il contenuto per ogni piattaforma.
5. Rendering media è separato dalla pubblicazione.
6. Nessun rendering blocca la pipeline principale.
7. Se video fallisce → render_status = failed, ma thread/carousel continuano invariati.
8. In fase di test: massimo 2 articoli esistenti per le prove. Mai --all in CI.
```

---

### 12.2 — Schema contenuto canonico aggiornato

Lo schema v2 si estende con i nuovi campi video. `video_scenes` sta a **root**,
non dentro `formats.tiktok` — le stesse scene potranno diventare Reel Instagram
o YouTube Short in V2.

```json
{
  "schema_version": 2,
  "agent": "ai-news",
  "slug": "...",
  "title": "...",
  "prompt_version": "1.0.0",
  "status": "draft",
  "render_status": "pending",
  "render_version": "1",
  "publish_status": {
    "x": "pending",
    "instagram": "pending",
    "tiktok": "pending"
  },
  "publish_error": {
    "x": null,
    "instagram": null,
    "tiktok": null
  },

  "slides": [],
  "carousel_slides": [],
  "video_scenes": [
    {
      "scene": 1,
      "voice": "This sensor will fix your posture forever.",
      "subtitle": "Fix your posture forever",
      "query": "man with bad posture office",
      "duration": 3,
      "motion": "zoom-in",
      "transition": "fade"
    }
  ],

  "formats": {
    "x":         { "thread": [] },
    "instagram": { "caption": "", "carousel": [] },
    "tiktok":    { "script": [], "reel": { "scenes_ref": "video_scenes" } }
  },

  "metrics": {
    "x":         {},
    "instagram": {},
    "tiktok":    {}
  }
}
```

> **`render_version`:** campo stringa, inizia a `"1"`. Quando aggiorni il renderer
> (V1 → V2), incrementa. Permette di sapere quali video vanno rigenerati senza
> ispezionare il file mp4.

> **`publish_error`:** salva il messaggio di errore per canale. Esempio:
> `"tiktok": "file size 58MB exceeds limit 50MB"`. Senza questo campo un errore
> CI di 3 giorni fa è irrecuperabile.

> **`render_status` separato da `status`:** il render può fallire indipendentemente
> dall'approvazione. Così puoi ripubblicare solo su TikTok senza ri-approvare l'articolo.

---

### 12.3 — Stack tecnico V1

| Layer | Tool | Ruolo | Costo |
|---|---|---|---|
| Scene generation | DeepSeek | genera query semantiche + pacing | quasi zero |
| Stock video | Pexels Video API | clip verticali, B-roll | gratis |
| Voice | OpenAI TTS o ElevenLabs | voiceover per scena | ~0.1–0.5 €/video |
| Rendering | ffmpeg | composizione, crop, subtitles | gratis |
| Font | `assets/fonts/Inter-Bold.ttf` | subtitles consistenti | gratis |
| Export | ffmpeg H264 | mp4 1080×1920 | gratis |

**Stima costi V1:** 100–300 video/mese ≈ 5–15 € (solo TTS).
Il costo vero è CPU render time, non API.

---

### 12.4 — Architettura video: ordine fisso delle operazioni

Questo ordine non è negoziabile. Claude Code deve rispettarlo senza parallelizzare
i passi 2–4, perché la durata calcolata in 2 influenza sia 3 che 4.

```
1. generateVideoScenes(article)
   → 5 scene con voice text, query, motion, transition

2. estimateDuration(scene.voice)      ← fonte vera della durata
   → durata deterministica da parole, NON da DeepSeek, NON da ffprobe

3. fetchPexelsVideo(query, { sceneIndex, usedClipIds, minDuration: dur + 0.5 })
   → clip garantita abbastanza lunga (minDuration = durata scena + 0.5s buffer)

4. TTS(scene.voice)
   → file audio per ogni scena

5. ffmpeg compose
   → resize + crop verticale + motion + subtitles + concatenazione + voiceover
   → export mp4 1080×1920 H264

6. ffprobe verify (solo verifica finale — non usato per timing)
   → controlla durata totale, dimensione file, codec
```

---

### 12.5 — `estimateDuration(text)`

```js
// core/video-utils.js
function estimateDuration(text, wpm = 130) {
  // wpm: 130 per OpenAI TTS, 120 per ElevenLabs
  const words = text.trim().split(/\s+/).length;
  return Math.max(2.5, Math.min(5, Math.ceil(words * 60 / wpm)));
}
```

**Regola:** la `duration` nelle `video_scenes` generate da DeepSeek è solo
un suggerimento. Il renderer la ignora e ricalcola sempre da `voice`.

---

### 12.6 — `generateVideoScenes(article)`

```
// Funzione in agents/{agentId}/prompts.js o in core/generate-video.js

Input:
  article.video_script   → 5 righe parlate
  article.carousel_slides → visual_hint per ogni slide
  article.title

Output per ogni scena:
  voice      → testo parlato (uguale a video_script[i])
  subtitle   → versione abbreviata (max 5 parole) per overlay
  query      → query semantica per Pexels Video (es. "man with bad posture office")
  motion     → "zoom-in" | "zoom-out" | "pan-right" | "pan-left" | "static"
  transition → "fade" | "cut" | "slide"
  duration   → stima DeepSeek (ignorata dal renderer — viene ricalcolata)

Prompt DeepSeek:
  Usa visual_hint e voice per generare query Pexels semanticamente coerenti.
  Non inventare query generiche. La query deve descrivere una scena reale
  che si trova nel B-roll stock: persone, oggetti, ambienti, azioni.
  Esempi buoni: "chef slicing vegetables kitchen", "runner morning city park"
  Esempi sbagliati: "concept of innovation", "abstract technology"
```

---

### 12.7 — `fetchPexelsVideo(query, options)`

```js
// core/fetch-video.js

async function fetchPexelsVideo(query, options = {}) {
  const {
    sceneIndex    = 0,
    usedClipIds   = new Set(),
    minDuration   = 3,         // deve essere sceneDuration + 0.5
    orientation   = 'portrait'
  } = options;

  // 1. Controlla cache: cache/video-clips/{hash(query)}.json
  //    La cache contiene un ARRAY di risultati, non un singolo clip
  const cached = loadVideoCache(query);
  const results = cached || await searchPexels(query, { orientation, minDuration });

  // 2. Salva array in cache se nuovi risultati
  if (!cached) saveVideoCache(query, results);

  // 3. Scegli clip con anti-duplicato
  //    results[sceneIndex % results.length] — clip diversa per scene diverse
  //    Se la clip è già in usedClipIds, prova la successiva (max results.length tentativi)
  let clip = null;
  for (let i = 0; i < results.length; i++) {
    const candidate = results[(sceneIndex + i) % results.length];
    if (!usedClipIds.has(candidate.id)) {
      clip = candidate;
      usedClipIds.add(candidate.id);
      break;
    }
  }

  // 4. Fallback: black clip se nessuna clip trovata o disponibile
  if (!clip) return { type: 'black', duration: minDuration };

  return { type: 'video', url: clip.video_files[0].link, id: clip.id };
}
```

**Nota rate limit Pexels Video:** stesso limite delle immagini (200 req/ora),
ma le response sono più pesanti. Non fare backfill massivi in CI.
Il flag `--limit` nel renderer è obbligatorio — vedi sezione 12.10.

---

### 12.8 — Fallback: black clip con subtitle

Quando Pexels non trova clip (o tutte sono già usate), il renderer genera
una clip nera **con traccia audio silenziosa** tramite ffmpeg:

```bash
ffmpeg \
  -f lavfi -i color=c=black:s=1080x1920:r=30 \
  -f lavfi -i anullsrc=r=44100:cl=stereo \
  -t DURATION \
  -shortest \
  -c:v libx264 -c:a aac \
  black_scene.mp4
```

> **Critico:** la traccia audio silenziosa (`anullsrc`) è obbligatoria.
> Senza di essa, la concatenazione con `concat` filter fallisce se altre
> clip hanno audio, producendo output con desync o errore silenzioso.

Sopra la black clip vengono applicati:
- Subtitle grande centrato (font `Inter-Bold.ttf`, size 64)
- Badge agente in basso (`theme.badge`)
- Gradiente sottile del tema agente (opzionale V1.1)

---

### 12.9 — Pipeline ffmpeg: crop verticale

Il problema principale con Pexels: le clip sono spesso 16:9, non 9:16.
Il resize diretto produce bande nere. La soluzione è `scale + crop + setsar`:

```bash
# Per clip orizzontale (es. 1920x1080) → verticale (1080x1920)
ffmpeg -i clip.mp4 \
  -vf "scale=1920:1080,crop=1080:1920:420:0,setsar=1" \
  -c:v libx264 clip_vertical.mp4

# Per clip già verticale o portrait (es. 1080x1920)
ffmpeg -i clip.mp4 \
  -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1" \
  -c:v libx264 clip_vertical.mp4
```

> **`setsar=1`** normalizza il Sample Aspect Ratio — senza di esso alcuni
> player mostrano il video distorto anche se le dimensioni sono corrette.

**Strip audio da tutte le clip prima della concatenazione:**
```bash
ffmpeg -i clip.mp4 -an -c:v libx264 clip_noaudio.mp4
```
Regola V1: una sola traccia audio finale (il voiceover).
Non mescolare audio nativo delle clip con il voiceover.

---

### 12.10 — `render-video.js` — vincoli obbligatori V1

```
render/render-video.js

Flag obbligatori:
  --agent   ai-news | food | fitness
  --slug    slug dell'articolo specifico
  --limit   numero massimo articoli (default: 1, massimo in test: 2)

Regole hardcoded:
  1. --all non esiste. Mai. Aggiungere questo controllo esplicito:
     if (process.argv.includes('--all')) {
       console.error('❌ --all non è supportato. Usa --limit 2 per il test.');
       process.exit(1);
     }

  2. In fase di test --limit è bloccato a 2:
     const MAX_TEST_LIMIT = 2;
     if (limit > MAX_TEST_LIMIT) {
       console.error(`❌ --limit ${limit} non permesso in fase di test (max ${MAX_TEST_LIMIT}).`);
       console.error('   Rimuovi questo vincolo esplicitamente nel codice quando V1 è validato.');
       process.exit(1);
     }

  3. Il renderer gira solo su articoli con render_status !== 'rendered' E status === 'approved'.
     Non tocca mai articoli in produzione non approvati.

  4. Output path: output/{agentId}/renders/{slug}.mp4
     La directory viene creata se non esiste.
     Controllare che output/{agentId}/renders/ sia in .gitignore prima del primo render.

  5. Aggiorna render_status nel JSON dell'articolo al termine:
     'rendered' se successo, 'failed' + render_error se fallisce.
     Non scrivere mai nel JSON se il render è ancora in corso.
```

---

### 12.11 — Failure isolation

Se qualsiasi step della pipeline video fallisce, il sistema deve:

```
Pexels Video down   → usa black clip, continua
TTS down            → render_status = 'failed', articolo non perso
ffmpeg error        → render_status = 'failed', log errore completo
File troppo grande  → render_status = 'failed', publish_error.tiktok = "size > 50MB"

In tutti i casi:
  - formats.x.thread        → invariato, pubblicabile
  - formats.instagram.caption + carousel_slides → invariati, pubblicabili
  - L'articolo non viene eliminato
  - Il run successivo riprova il render (render_status !== 'rendered')
```

---

### 12.12 — Publisher adapters

```
publish/
  scheduler.js          ← legge articoli con status: 'approved' + render_status: 'rendered'
  publisher-x.js        ← posta thread su X via API Twitter v2
  publisher-instagram.js← carica carousel (5 PNG) + caption su Instagram Graph API
  publisher-tiktok.js   ← upload mp4 su TikTok Content Posting API

Ogni publisher:
  - riceve asset già renderizzati (mp4, PNG già generati)
  - non genera contenuto
  - pubblica soltanto
  - aggiorna publish_status[canale] nel JSON: 'published' | 'failed'
  - salva publish_error[canale] se fallisce
  - retry max 3 volte con backoff esponenziale

Workflow status completo:
  draft → approved → scheduled → published → failed
                              ↳ render_status: pending → rendered → failed
                                                        ↳ retry automatico al prossimo run
```

---

### 12.13 — V1 / V2 / V3 — roadmap qualità

**V1 — minimo funzionante (implementare ora)**
- `generateVideoScenes()` con DeepSeek
- 1 clip Pexels per scena (portrait, minDuration = sceneDuration + 0.5)
- Black clip come fallback con subtitle
- TTS singolo audio completo (non per scena)
- Subtitles bruciati con ffmpeg drawtext + Inter-Bold.ttf
- Motion semplice (zoom-in/out via `zoompan` filter)
- Export mp4 1080×1920 H264 max 50MB
- Cache clip Pexels (array di risultati per query)
- Rate limiter su Pexels Video API
- `--limit 2` bloccato, niente `--all`

**V1.1 — stabilità (dopo validazione V1)**
- Scelta migliore tra 5 risultati Pexels (prefer portrait nativo)
- `sessionUsedIds` condiviso tra tutti i video del run
- TTS per scena (audio sincronizzato con clip)
- Fallback immagine statica come alternativa a black clip
- Template separati per agente (colori, font size, badge position)

**V2 — qualità (dopo 30+ video validati)**
- Scelta clip per qualità semantica (DeepSeek valuta pertinenza)
- Music background royalty-free
- Subtitle word-by-word con timing da TTS
- Motion avanzato (pan + zoom compositi)
- Beat sync con voiceover

**V3 — futuro lontano**
- Video generation AI (Runway / Kling / Pika) come opzione premium
- Avatar AI opzionale
- Auto-cut da trascrizione

---

### 12.14 — Test obbligatori (in ordine)

Eseguire in sequenza. Non procedere al test successivo se il precedente fallisce.

#### TEST 0 — Prerequisiti

```bash
node scripts/check-video-prereqs.js
```

Lo script deve verificare:
- `ffmpeg -version` → presente e >= 4.x
- `ffmpeg -filters | grep drawtext` → presente (libfreetype)
- `ffprobe -version` → presente
- `assets/fonts/Inter-Bold.ttf` → file esiste
- `.gitignore` contiene `output/*/renders/`
- `.railwayignore` contiene `output/*/renders/`
- `PEXELS_API_KEY` presente in env
- `TTS_API_KEY` (OpenAI o ElevenLabs) presente in env

**Atteso:** tutti i check ✅. Se anche uno fallisce, non procedere.

#### TEST 1 — `estimateDuration`

```bash
node -e "
const { estimateDuration } = require('./core/video-utils');
console.log(estimateDuration('This sensor fixes your back.'));        // ~2.5
console.log(estimateDuration('This thirty dollar sensor permanently fixes your posture forever trust me')); // ~4-5
console.log(estimateDuration('Short'));                               // deve essere 2.5 (min)
// Verifica che NON sia mai < 2.5 e MAI > 5
"
```

#### TEST 2 — `generateVideoScenes`

```bash
# Usa un articolo reale esistente
node -e "
const fs = require('fs');
const { generateVideoScenes } = require('./core/generate-video');
const file = fs.readdirSync('output').filter(f=>f.endsWith('.json')).sort().reverse()[0];
const article = JSON.parse(fs.readFileSync('output/'+file));
generateVideoScenes(article).then(scenes => {
  console.log('scene count:', scenes.length);          // deve essere 5
  scenes.forEach((s, i) => {
    console.log('scena', i+1, ':');
    console.log('  voice:', s.voice?.slice(0,50));
    console.log('  subtitle:', s.subtitle);            // max 5 parole
    console.log('  query:', s.query);                  // deve essere specifica
    console.log('  motion:', s.motion);                // zoom-in | zoom-out | pan-right | pan-left | static
    console.log('  transition:', s.transition);        // fade | cut | slide
    // Verifica che query NON sia generica
    const badQueries = ['technology', 'innovation', 'concept', 'abstract'];
    if (badQueries.some(b => s.query.toLowerCase().includes(b))) {
      console.warn('  ⚠️  query potenzialmente generica');
    }
  });
});
"
```

**Atteso:** 5 scene, tutte con query specifiche e motion valido.

#### TEST 3 — `fetchPexelsVideo`

```bash
node -e "
const { fetchPexelsVideo } = require('./core/fetch-video');
const usedClipIds = new Set();

// Scena 0
fetchPexelsVideo('man with bad posture office', {
  sceneIndex: 0, usedClipIds, minDuration: 3.5, orientation: 'portrait'
}).then(clip => {
  console.log('clip 0 type:', clip.type);   // 'video' o 'black'
  if (clip.type === 'video') {
    console.log('clip 0 id:', clip.id);
    console.log('clip 0 url:', clip.url?.slice(0,60));
    usedClipIds.add(clip.id);
  }

  // Stessa query, scena diversa — deve restituire clip diversa se possibile
  return fetchPexelsVideo('man with bad posture office', {
    sceneIndex: 1, usedClipIds, minDuration: 3.5, orientation: 'portrait'
  });
}).then(clip2 => {
  console.log('clip 1 type:', clip2.type);
  console.log('clip 1 id:', clip2.id);
  // id deve essere diverso da clip 0 se ci sono risultati sufficienti
});
"
```

**Atteso:** clip diversa per scene diverse con stessa query.

#### TEST 4 — render singola scena

```bash
node render/render-video.js --agent ai-news --slug TEST_SINGLE_SCENE --scene 0
# Produce: output/ai-news/renders/TEST_SINGLE_SCENE_scene0.mp4

# Verifica con ffprobe
ffprobe -v quiet -print_format json -show_streams output/ai-news/renders/TEST_SINGLE_SCENE_scene0.mp4 | \
  node -e "
    const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const v = d.streams.find(s=>s.codec_type==='video');
    const a = d.streams.find(s=>s.codec_type==='audio');
    console.log('video codec:', v?.codec_name);   // h264
    console.log('width:', v?.width);              // 1080
    console.log('height:', v?.height);            // 1920
    console.log('audio presente:', !!a);           // true
  "
```

**Atteso:** 1080×1920, H264, audio presente.

#### TEST 5 — render completo 5 scene

```bash
# Prende il primo articolo approved con limit 1
node render/render-video.js --agent ai-news --limit 1

# Verifica output
SLUG=$(ls -t output/ai-news/renders/*.mp4 2>/dev/null | head -1)
ffprobe -v quiet -print_format json -show_streams -show_format "$SLUG" | \
  node -e "
    const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const dur = parseFloat(d.format?.duration);
    const size = parseInt(d.format?.size);
    console.log('durata totale:', dur.toFixed(1), 'sec');  // 15–30 sec atteso
    console.log('dimensione:', (size/1024/1024).toFixed(1), 'MB');  // < 50MB
    const v = d.streams.find(s=>s.codec_type==='video');
    console.log('risoluzione:', v?.width + 'x' + v?.height);  // 1080x1920
    console.log('codec:', v?.codec_name);  // h264
  "
```

**Atteso:** durata 15–30s, < 50MB, 1080×1920, H264.

#### TEST 6 — failure isolation

```bash
# Simula Pexels down: disconnetti rete o usa query impossibile
node -e "
const { fetchPexelsVideo } = require('./core/fetch-video');
fetchPexelsVideo('QUERY_CHE_NON_ESISTE_MAI_12345xyz', {
  sceneIndex: 0, usedClipIds: new Set(), minDuration: 3
}).then(clip => {
  console.log('tipo fallback:', clip.type);  // deve essere 'black', non crash
});
"

# Verifica che dopo un render fallito l'articolo sia ancora valido
node scripts/contract-test.js
# Atteso: 0 FAIL — i campi text/carousel restano intatti
```

#### TEST 7 — no git pollution

```bash
# Dopo aver prodotto almeno 1 mp4
node render/render-video.js --agent ai-news --limit 1

git status
# output/ai-news/renders/ NON deve apparire
# Se appare: aggiorna .gitignore e fai git rm --cached
```

#### TEST 8 — vincolo --limit

```bash
# Verifica che --limit > 2 venga bloccato in fase di test
node render/render-video.js --agent ai-news --limit 3
# Atteso: errore esplicito "limit massimo in test è 2"

# Verifica che --all non esista
node render/render-video.js --agent ai-news --all
# Atteso: errore esplicito "--all non è supportato"
```

#### TEST 9 — font e drawtext

```bash
# Verifica che drawtext funzioni con Inter-Bold.ttf
ffmpeg -f lavfi -i color=c=black:s=1080x1920:r=30 \
  -vf "drawtext=fontfile=assets/fonts/Inter-Bold.ttf:text='Test subtitle':fontsize=64:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2" \
  -t 2 -y /tmp/drawtext_test.mp4 2>&1 | tail -5
# Atteso: nessun errore, file /tmp/drawtext_test.mp4 creato

# Verifica che il font path relativo funzioni anche da directory diversa
cd /tmp && node -e "
  require('child_process').execSync(
    'ffmpeg -f lavfi -i color=c=black:s=100x100:r=30 ' +
    '-vf \"drawtext=fontfile=$(pwd)/assets/fonts/Inter-Bold.ttf:text=OK:fontsize=20\" ' +
    '-t 1 -y /tmp/font_test.mp4',
    { cwd: process.env.HOME + '/visual-scroll-blog', stdio: 'inherit' }
  );
  console.log('font test OK');
"
cd -
```

---

### 12.15 — Prompt Claude Code — check-video-prereqs.js

```
Crea il file scripts/check-video-prereqs.js.

Lo script verifica tutti i prerequisiti tecnici per la pipeline video.
Per ogni check stampa ✅ o ❌ con messaggio.
Se anche un solo check fallisce, termina con exit code 1.

Check da eseguire:
1. ffmpeg -version → eseguibile e risponde
2. ffmpeg -filters 2>&1 | grep drawtext → presente nella lista
3. ffprobe -version → eseguibile e risponde
4. fs.existsSync('assets/fonts/Inter-Bold.ttf') → file presente
5. Legge .gitignore e verifica che contenga "output/*/renders/"
6. Legge .railwayignore e verifica che contenga "output/*/renders/"
7. process.env.PEXELS_API_KEY → presente e non vuoto
8. process.env.OPENAI_API_KEY o process.env.ELEVENLABS_API_KEY → almeno uno presente

Usa child_process.execSync per i check ffmpeg/ffprobe con try/catch.
Non modificare nessun altro file.
```

---

### 12.16 — Prompt Claude Code — core/video-utils.js

```
Crea il file core/video-utils.js.

Esporta:

1. estimateDuration(text, wpm = 130)
   - Conta le parole in text (split su whitespace)
   - Calcola durata: Math.ceil(words * 60 / wpm)
   - Clamp tra 2.5 e 5 secondi
   - Restituisce numero float

2. hashQuery(query)
   - Restituisce md5(query.toLowerCase().trim())
   - Usato come chiave cache per Pexels Video

3. buildBlackClip(outputPath, duration)
   - Esegue il comando ffmpeg per generare black clip con audio silenzioso
   - ffmpeg -f lavfi -i color=c=black:s=1080x1920:r=30
          -f lavfi -i anullsrc=r=44100:cl=stereo
          -t DURATION -shortest -c:v libx264 -c:a aac OUTPUT_PATH
   - Restituisce Promise<void>, rigetta se ffmpeg fallisce
   - Usa path assoluto per il font se drawtext è richiesto

4. verifyMp4(filePath)
   - Esegue ffprobe -v quiet -print_format json -show_streams -show_format
   - Restituisce { width, height, duration, sizeBytes, codec }
   - Lancia errore se codec !== 'h264' o sizeBytes > 50 * 1024 * 1024

Non modificare nessun altro file.
```

---

### 12.17 — Prompt Claude Code — core/fetch-video.js

```
Crea il file core/fetch-video.js.

Esporta la funzione:

async function fetchPexelsVideo(query, options = {})

Parametri options:
  sceneIndex    = 0         (indice scena — per scegliere clip diverse con stessa query)
  usedClipIds   = new Set() (clip già usate in questo video — anti-duplicato)
  minDuration   = 3         (durata minima clip in secondi — deve essere sceneDuration + 0.5)
  orientation   = 'portrait' (preferisce clip verticali)

Logica interna:

1. Cache: legge cache/video-clips/{hashQuery(query)}.json se esiste
   La cache contiene un array di oggetti clip Pexels, NON un singolo clip.
   Se la cache non esiste, chiama Pexels Video API:
     GET https://api.pexels.com/videos/search
     params: { query, orientation, per_page: 10, min_duration: minDuration }
     header: Authorization: PEXELS_API_KEY
   Salva i risultati in cache.
   Crea la directory cache/video-clips/ se non esiste.

2. Selezione clip con anti-duplicato:
   - Parte da results[sceneIndex % results.length]
   - Se la clip è in usedClipIds, prova la successiva (max results.length tentativi)
   - Aggiunge la clip scelta a usedClipIds
   - Scegli il video_file con la risoluzione più vicina a 1080×1920 (portrait)

3. Fallback:
   - Se results è vuoto o tutte le clip sono già usate:
     restituisce { type: 'black', duration: minDuration }
   - Altrimenti restituisce:
     { type: 'video', url: clip.video_files[best].link, id: clip.id, duration: clip.duration }

Gestione errori:
   - Se la chiamata API Pexels fallisce: loga warning, restituisce fallback black
   - Non lanciare mai eccezioni non gestite — la pipeline deve continuare

Non modificare nessun altro file.
```

---

### 12.18 — Prompt Claude Code — render/render-video.js

```
Crea il file render/render-video.js.

Il renderer assembla il video finale per un articolo.

CLI:
  node render/render-video.js --agent ai-news --limit 1
  node render/render-video.js --agent food --slug specific-slug

Vincoli hardcoded (NON rimuovere senza commit esplicito):
  1. --all non esiste:
     if (argv.includes('--all')) { console.error('❌ --all non supportato'); process.exit(1); }
  2. --limit massimo 2 in fase di test:
     const MAX_TEST_LIMIT = 2;
     if (limit > MAX_TEST_LIMIT) {
       console.error(`❌ --limit ${limit} non permesso (max ${MAX_TEST_LIMIT} in fase test)`);
       console.error('   Rimuovi MAX_TEST_LIMIT nel codice quando V1 è validato.');
       process.exit(1);
     }
  3. Renderizza solo articoli con status === 'approved' E render_status !== 'rendered'

Pipeline per ogni articolo:
  1. Carica article JSON da output/{agentId}/{slug}.json
  2. Chiama generateVideoScenes(article) → scenes[]
  3. Per ogni scena:
     a. dur = estimateDuration(scene.voice)
     b. clip = await fetchPexelsVideo(scene.query, { sceneIndex: i, usedClipIds, minDuration: dur + 0.5 })
     c. Se clip.type === 'video': scarica in output/{agentId}/renders/clips/{clip.id}.mp4
        Se clip.type === 'black': genera black clip con buildBlackClip()
     d. Resize + crop verticale con ffmpeg: scale → crop → setsar=1 → strip audio (-an)
     e. Genera TTS audio per scene.voice → output/{agentId}/renders/audio/{slug}_scene{i}.mp3
  4. Concatena le 5 clip con ffmpeg concat filter
  5. Aggiungi voiceover: merge audio TTS sul video concatenato
  6. Aggiungi subtitles con drawtext usando assets/fonts/Inter-Bold.ttf
     (path assoluto nel comando ffmpeg per compatibilità CI)
  7. Export finale: output/{agentId}/renders/{slug}.mp4
  8. Verifica con verifyMp4(): controlla 1080×1920, H264, < 50MB
  9. Aggiorna article JSON:
     render_status: 'rendered' (o 'failed' se step 8 fallisce)
     render_version: '1'
     Se fallisce: render_status = 'failed', salva messaggio di errore in article.render_error

Failure isolation:
  - Ogni step è in try/catch
  - Se un singolo step fallisce per UN articolo: logga errore, setta render_status='failed',
    continua con l'articolo successivo
  - Non toccare mai formats.x.thread, formats.instagram.caption, carousel_slides

Non modificare nessun altro file.
Crea la directory render/ se non esiste.
```

---

## FASE 13 — Carousel unico ✅

> **Nota (2026-05-17):** completata con una differenza rispetto al piano:
> `carousel-food.html` è stato **rimosso definitivamente** (non mantenuto come redirect).
> È stato aggiunto il proxy server-side `/proxy-image` in `server.js` per risolvere il
> problema CORS di GialloZafferano durante il download PNG food: html2canvas non può
> leggere i pixel di immagini senza CORS headers, il proxy fetcha server-to-server e
> restituisce con `Access-Control-Allow-Origin: *`. Pexels (slide 2-5) non usa il proxy
> perché ha già CORS headers.

**Obiettivo:** unificare `carousel.html` e `carousel-food.html` in
`carousel.html?agent=food` / `carousel.html?agent=ai-news`.

### Prompt Claude Code

```
Unifica carousel.html e carousel-food.html in un unico carousel.html
parametrizzato su ?agent=ai-news (default) e ?agent=food.

Il tema (palette, badge, handle, gradienti) deve arrivare dal registry degli agenti:
const agentId = new URLSearchParams(window.location.search).get('agent') || 'ai-news';
// carica window.AGENTS[agentId] e applica il theme della config

Mantieni carousel-food.html come redirect temporaneo:
<meta http-equiv="refresh" content="0; url=carousel.html?agent=food">

Prima di rimuovere carousel-food.html:
1. Testa il download PNG per almeno 3 ricette food — verifica palette olive/arancio
2. Testa il download PNG per almeno 3 articoli AI news — verifica palette blu
3. Solo dopo: rimuovi carousel-food.html e il redirect
```

### Test manuali FASE 13

```bash
# Test PNG food
open "http://localhost:3000/carousel.html?agent=food"
# Scarica 3 PNG — verifica palette olive/arancio, badge "5 STEP FOOD", @FlashKitchen

# Test PNG AI news
open "http://localhost:3000/carousel.html?agent=ai-news"
# Scarica 3 PNG — verifica palette blu, badge "AI NEWS", @FlashAI

# Solo dopo verifica visiva rimuovi il vecchio file
rm frontend/carousel-food.html
```

---

## Riepilogo ordine e dipendenze

```
FASE 0  ✅ baseline
FASE 1  ✅ schema v2 + video_scenes + render_status + publish_status per canale
FASE 1B ✅ protezione backfill
FASE 2  ⏭ cache split (saltata — cache.json con prefissi sufficiente)
FASE 3  ✅ registry agenti e canali
FASE 4  ✅ config agenti (ai-news, food, fitness)
FASE 5  ✅ runner unico (core/run-agent.js)
FASE 6  ✅ migrazione food sul runner
FASE 7  ✅ migrazione AI news sul runner
FASE 8  ✅ channel adapters (x, instagram, tiktok)
FASE 9  ✅ agente fitness
FASE 10 ✅ data-agents.js (window.AGENTS unificato)
FASE 11 ✅ review multi-canale (badge agente, status, select canale, copia per canale)
FASE 12 🔒 media pipeline & autonomous publishing
        prerequisito: 30 articoli approved + TEST 0–9 tutti ✅
        ordine interno:
          12.0  verifica prerequisiti (check-video-prereqs.js)
          12.15 scripts/check-video-prereqs.js
          12.16 core/video-utils.js
          12.17 core/fetch-video.js
          12.18 render/render-video.js
          TEST 0 → TEST 9 (in sequenza, no skip)
          V1 validato → rimuovi MAX_TEST_LIMIT → V1.1
          12.12 publish/ (solo dopo V1 stabile)
FASE 13 ✅ carousel unico (carousel.html?agent=, proxy food, carousel-food.html rimosso)
```

**Prossima azione:** accumulare 30 articoli approvati manualmente da `review.html`,
poi eseguire TEST 0 di FASE 12 prima di scrivere una riga di codice video.

---

## Checklist pre-commit per ogni fase

Prima di fare `git commit` su qualsiasi fase:

```bash
# 1. Contract test passa
node scripts/contract-test.js
# Atteso: 0 FAIL

# 2. Baseline invariato (o variazione attesa e spiegata)
node scripts/baseline.js

# 3. Runner originali funzionanti
MAX_NEW_ARTICLES=0 node run.js
MAX_NEW_FOOD_ARTICLES=0 node run-food.js

# 4. Nessun errore di require
node -e "require('./agents/index')"
node -e "require('./channels/index')"
node -e "require('./core/run-agent')"

# 5. Solo per commit che toccano FASE 12
node scripts/check-video-prereqs.js
# Atteso: tutti ✅

# 6. Nessun mp4 in git status
git status | grep -E "\.mp4|renders/"
# Atteso: nessun output
```
