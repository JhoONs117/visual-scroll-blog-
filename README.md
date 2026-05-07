\# Visual AI Scroll Blog



Sistema automatico che intercetta notizie AI, le filtra, le trasforma in slide + thread X + script video, e le mostra come feed scrollabile in stile Instagram Stories.



\*\*Stack:\*\* Node.js · DeepSeek API · GitHub Actions · Railway · HTML/CSS puro



\*\*Stato attuale (2026-05-06):\*\* M1–M17 + M15 completate · 44 articoli unici · pipeline automatica ogni 2 ore



\---



\## Milestones di sviluppo



Segui questo ordine. Completa e testa ogni milestone prima di passare alla successiva.



\*\*Milestone completate:\*\* M1 M2 M3 M4 M5 M6 M7 M8 M9 M10 M11 M12 M13 M14 M15 M16 M17



\*\*Prossima:\*\* M21 — Test di distribuzione reale (checkpoint obbligatorio)



\---



\### Milestone 1 — Setup progetto ✅



\*\*Obiettivo:\*\* struttura file pronta, dipendenze installate, variabili d'ambiente configurate.



Prompt per Claude Code:

```

Inizializza un progetto Node.js con npm init -y.

Installa le dipendenze: axios, rss-parser, dotenv, md5.

Crea la struttura file:

\- run.js (vuoto)

\- deepseek.js (vuoto)

\- fetch.js (vuoto)

\- filter.js (vuoto)

\- generate.js (vuoto)

\- validate.js (vuoto)

\- cache.json (oggetto vuoto {})

\- review\_queue.json (array vuoto \[])

\- cartella output/

\- cartella frontend/ con index.html vuoto

Crea un file .env con la variabile DEEPSEEK\_API\_KEY=da\_inserire

Crea un .gitignore che ignora node\_modules e .env

```



\*\*Test:\*\* `ls` mostra tutti i file, `npm install` non dà errori.



\---



\### Milestone 2 — Connessione DeepSeek ✅



\*\*Obiettivo:\*\* verificare che la API key funziona e che DeepSeek risponde correttamente.



Prompt per Claude Code:

```

In deepseek.js crea una funzione callDeepSeek(prompt) che:

\- carica DEEPSEEK\_API\_KEY da .env con dotenv

\- chiama https://api.deepseek.com/v1/chat/completions

\- usa il modello deepseek-chat

\- passa il prompt come messaggio user

\- restituisce il testo della risposta come stringa



Aggiungi in fondo un test che chiama la funzione con il prompt

"Rispondi solo: ok" e stampa il risultato.

Esporta la funzione con module.exports.

```



\*\*Test:\*\* `node deepseek.js` stampa "ok" o simile. Se non funziona, verificare la API key nel file .env.



\---



\### Milestone 3 — Raccolta RSS ✅



\*\*Obiettivo:\*\* recuperare titoli reali da feed RSS AI.



Prompt per Claude Code:

```

In fetch.js crea una funzione fetchArticles() che:

\- usa rss-parser per leggere questi feed:

&#x20; - https://feeds.feedburner.com/oreilly/radar

&#x20; - https://www.artificialintelligence-news.com/feed/

&#x20; - https://techcrunch.com/feed/

\- raccoglie tutti gli articoli in un array

\- restituisce un array di oggetti { title, link, pubDate }

\- gestisce gli errori per singolo feed senza bloccare gli altri



Aggiungi un test che chiama fetchArticles() e stampa

il numero di articoli trovati e i primi 3 titoli.

Esporta la funzione con module.exports.

```



\*\*Test:\*\* `node fetch.js` stampa articoli reali. Se un feed fallisce, gli altri devono continuare.



\---



\### Milestone 4 — Deduplicazione e hard filter ✅



\*\*Obiettivo:\*\* ridurre gli articoli del 70-80% prima di toccare DeepSeek.



Prompt per Claude Code:

```

In filter.js implementa tre funzioni:



1\. normalize(title)

&#x20;  - converte in minuscolo

&#x20;  - rimuove caratteri non alfanumerici

&#x20;  - prende le prime 5 parole

&#x20;  - restituisce la stringa normalizzata



2\. deduplicate(articles)

&#x20;  - riceve array di { title, link, pubDate }

&#x20;  - usa un Set per tracciare i titoli normalizzati gia visti

&#x20;  - restituisce solo gli articoli con titolo non ancora visto



3\. hardFilter(articles)

&#x20;  - whitelist: \["ai", "gpt", "agent", "llm", "model", "openai"]

&#x20;  - blacklist: \["funding", "politics", "lawsuit", "acquisition"]

&#x20;  - restituisce solo gli articoli che passano entrambi i controlli



Esporta tutte e tre le funzioni con module.exports.

Aggiungi un test che mostra quanti articoli restano dopo ogni step.

```



\*\*Test:\*\* `node filter.js` mostra il numero di articoli ridursi step by step.



\---



\### Milestone 5 — AI filter con batch reale ✅



\*\*Obiettivo:\*\* usare DeepSeek per valutare la qualita degli articoli rimasti, in batch da 10.



Prompt per Claude Code:

```

In filter.js aggiungi una funzione batchAIFilter(articles) che:



\- divide gli articoli in batch da 10

\- per ogni batch chiama callDeepSeek() con questo prompt:



"Rispondi SOLO JSON valido.

Formato:

\[

&#x20; {"index": 0, "useful": true, "score": 8},

&#x20; {"index": 1, "useful": false, "score": 3}

]

Titoli:

0: {{title0}}

1: {{title1}}

..."



\- fa il parse della risposta JSON

\- verifica che ogni indice atteso sia presente nella risposta,

&#x20; se manca logga: console.warn("Indice mancante:", i)

\- restituisce solo gli articoli con useful=true e score >= 7



Esporta la funzione. Aggiungi un test con 3 titoli hardcoded.

```



\*\*Test:\*\* `node filter.js` mostra i titoli con score >= 7. Verificare che il JSON sia parsato correttamente.



\---



\### Milestone 6 — Generazione slide ✅



\*\*Obiettivo:\*\* trasformare ogni titolo in 5 slide strutturate.



Prompt per Claude Code:

```

In generate.js crea una funzione generateSlides(title) che:



\- chiama callDeepSeek() con questo prompt:



"Rispondi SOLO JSON valido.

Formato:

{

&#x20;slides: \[

&#x20; hook breve e forte,

&#x20; spiegazione semplice,

&#x20; perche e utile,

&#x20; azione pratica,

&#x20; esempio reale

&#x20;]

}

Regole:

\- max 8 parole per slide

\- linguaggio semplice

\- niente fluff

Titolo: {{title}}"



\- fa il parse della risposta

\- restituisce l'oggetto { title, slides }



Esporta la funzione. Aggiungi un test con un titolo hardcoded.

```



\*\*Test:\*\* `node generate.js` stampa un oggetto con 5 slide. Verificare che ogni slide abbia max 8 parole.



\---



\### Milestone 7 — Validazione e fallback ✅



\*\*Obiettivo:\*\* garantire che ogni output rispetti il formato prima di salvarlo.



Prompt per Claude Code:

```

In validate.js crea due funzioni:



1\. isValid(slides)

&#x20;  - restituisce true se slides ha esattamente 5 elementi

&#x20;  - e ogni slide ha max 8 parole



2\. validateWithFallback(title, generateFn)

&#x20;  - chiama generateFn(title) fino a 2 volte

&#x20;  - se isValid() passa, restituisce il risultato

&#x20;  - se fallisce entrambe le volte:

&#x20;    - logga: console.warn("FALLBACK TRIGGERED:", title)

&#x20;    - legge review\_queue.json

&#x20;    - aggiunge { title, result, timestamp } all'array

&#x20;    - salva review\_queue.json

&#x20;    - restituisce null



Esporta entrambe le funzioni.

```



\*\*Test:\*\* testare con un titolo che genera output non valido e verificare che appaia in review\_queue.json.



\---



\### Milestone 8 — Cache ✅



\*\*Obiettivo:\*\* evitare di rielaborare articoli gia processati.



Prompt per Claude Code:

```

In generate.js aggiungi la gestione della cache:



\- all'avvio legge cache.json in un oggetto in memoria

\- prima di generare, calcola md5(normalize(title))

\- se l'hash e gia in cache, restituisce il valore cached

\- dopo una generazione valida, salva in cache.json

\- usa la funzione normalize() importata da filter.js



Aggiungi anche un controllo: se review\_queue.json ha piu di 10

elementi, logga: console.warn("Review queue ha N elementi — controllare")

```



\*\*Test:\*\* chiamare `generateSlides()` due volte con lo stesso titolo. La seconda deve essere istantanea e non fare chiamate API.



\---



\### Milestone 9 — Orchestrazione run.js ✅



\*\*Obiettivo:\*\* collegare tutti i moduli in un unico flusso eseguibile.



Prompt per Claude Code:

```

In run.js implementa il flusso completo:



1\. fetchArticles() da fetch.js

2\. deduplicate() da filter.js

3\. hardFilter() da filter.js

4\. batchAIFilter() da filter.js

5\. per ogni articolo rimasto:

&#x20;  - validateWithFallback(title, generateSlides)

&#x20;  - se il risultato non e null, salva in output/{{timestamp}}\_{{slug}}.json

6\. logga un riepilogo finale:

&#x20;  - articoli fetched

&#x20;  - dopo dedup

&#x20;  - dopo hardFilter

&#x20;  - dopo AI filter

&#x20;  - slide generate

&#x20;  - fallback loggati



Usa async/await per tutto.

```



\*\*Test:\*\* `node run.js` esegue il pipeline completo e salva file JSON in output/.



\---



\### Milestone 10 — Frontend statico ✅



\*\*Obiettivo:\*\* validare il formato visivo su telefono reale prima di automatizzare.



Prompt per Claude Code:

```

In frontend/index.html crea una pagina con 5 slide hardcoded.



Contenuti di esempio:

1\. "GPT-5 cambia tutto quello che sai"

2\. "Modello AI con ragionamento avanzato"

3\. "Risponde meglio su task complessi"

4\. "Prova subito su chat.openai.com"

5\. "Un utente ha risolto bug in 3 secondi"



CSS richiesto:

\- scroll snap verticale (y mandatory)

\- ogni slide occupa 100vh

\- testo centrato, font-size 28px, font-weight 600

\- palette monocromatica:

&#x20; slide 1: background #0f172a, color #f8fafc

&#x20; slide 2: background #1e293b, color #f1f5f9

&#x20; slide 3: background #334155, color #f1f5f9

&#x20; slide 4: background #475569, color #f8fafc

&#x20; slide 5: background #0f172a, color #94a3b8

\- nessuna dipendenza esterna, solo HTML e CSS

```



\*\*Test obbligatorio su telefono:\*\*

\- \[ ] il testo e leggibile senza zoom

\- \[ ] lo scroll snap e fluido tra le slide

\- \[ ] 5 slide si consumano in meno di 15 secondi

\- \[ ] nessuna slide sembra vuota o troppo corta



> Se questo test fallisce, aggiustare il CSS prima di procedere. Il backend e inutile se il formato non funziona su mobile.



\---



\### Milestone 11 — Frontend dinamico ✅



\*\*Obiettivo:\*\* il frontend legge i JSON reali da output/ e mostra le slide generate.



\*\*Approccio:\*\* run.js scrive frontend/data.js con window.ARTICLES = [...] — nessun server richiesto.



Prompt per Claude Code:

```

Aggiorna run.js per scrivere frontend/data.js al termine del pipeline.
Il file deve contenere: window.ARTICLES = [ array di tutti gli oggetti {title, slides} salvati in output/ ];

Aggiorna frontend/index.html per:
- importare data.js con <script src="data.js">
- iterare window.ARTICLES e per ogni articolo generare un gruppo di 5 slide .slide
- mantenere lo stesso CSS scroll-snap gia presente
- se ARTICLES e vuoto mostrare un messaggio "Nessun articolo disponibile"

```



\*\*Test:\*\* aprire index.html nel browser dopo un run — devono apparire le slide reali.



\---



\### Milestone 12 — Automazione GitHub Actions ✅



\*\*Obiettivo:\*\* eseguire il pipeline automaticamente ogni 2 ore.



Prompt per Claude Code:

```

Mostrami il comando crontab da aggiungere per eseguire

node run.js ogni 2 ore, con output dei log salvato in logs/run.log.

Crea anche la cartella logs/ e aggiungila al .gitignore.

```



\*\*Attivazione:\*\*

```bash

crontab -e

\# aggiungere la riga suggerita da Claude Code

```



\---



\### Milestone 13 — Deploy ✅



\*\*Obiettivo:\*\* endpoint pubblico accessibile da qualsiasi dispositivo.



\*\*Opzioni:\*\* Railway (consigliato), Render (cold start problematico), VPS Hetzner ~4$/mese (massimo controllo).



\*\*Nota:\*\* fare deploy statico prima, aggiungere il cron (M12) solo dopo che gira in prod.



Prompt per Claude Code:

```

Configura il progetto per il deploy su Railway:
- aggiungi script "start" in package.json che esegue node run.js
- verifica che DEEPSEEK_API_KEY venga letta da variabile d'ambiente di Railway
- assicurati che output/ e frontend/ siano inclusi nel deploy

```



\---



\### Milestone 14 — Riscrittura prompt slide ✅



\*\*Obiettivo:\*\* slide con struttura narrativa (hook + contesto + sorprendente + pratico + takeaway) invece di essere descrittive. Limite 8 parole per slide, 2 esempi DA FARE / DA NON FARE nel prompt. Fallback sceso al ~8%.



\---



\### Milestone 16 — Output multi-formato ✅



\*\*Obiettivo:\*\* da ogni articolo generare \`thread\_text\` (5 tweet) e \`video\_script\` (5 righe parlate) pronti per distribuzione. Controllato da variabile d'ambiente \`GENERATE\_FORMATS=true\`.



\---



\### Milestone 17 — Pagina di review ✅



\*\*Obiettivo:\*\* \`frontend/review.html\` — pagina locale dark-theme per leggere e copiare tutti i contenuti. Tasto "Copia tutto" per articolo, data relativa, articoli completi mostrati prima.



\---



\### Milestone 15 — Frontend UX a due assi ✅



\*\*Obiettivo:\*\* layout Instagram Stories + TikTok feed. Swipe orizzontale = slide successiva (stessa notizia), swipe verticale = notizia successiva. Testato su Android Chrome e iPhone Safari — tutti e 7 gli scenari superati.



\*\*Layout:\*\* 3 aree verticali per slide — area visual (gradiente colorato), area content (badge + titolo), area info (dot indicators + icone + caption con data).



\---



\## Divisione AI



| Ruolo | Tool | Perche |

|---|---|---|

| Produzione (filtro + slide) | DeepSeek | Costo basso, sufficiente per task strutturati |

| Sviluppo (codice + debug) | Claude Code | Qualita alta, usato solo in dev |



> Non usare Claude a runtime — costa troppo per un sistema automatico.



\---



\## Architettura pipeline



```

fetch RSS

&#x20;-> dedup fuzzy

&#x20;-> hard filter (no AI)

&#x20;-> batch AI filter (DeepSeek)

&#x20;-> score filter (>= 7)

&#x20;-> generate slides (DeepSeek)

&#x20;-> validate + fallback

&#x20;-> save JSON

```



\---



\## Dettaglio step tecnici



\### Deduplicazione fuzzy



Evita duplicati anche tra titoli leggermente diversi tra fonti diverse.



```js

function normalize(title) {

&#x20; return title

&#x20;   .toLowerCase()

&#x20;   .replace(/\[^a-z0-9 ]/g, "")

&#x20;   .split(" ")

&#x20;   .slice(0, 5)

&#x20;   .join(" ");

}



const key = normalize(title);

if (seen.has(key)) return;

seen.add(key);

```



\### Hard filter



Riduce le chiamate AI del 70-80% prima ancora di toccare DeepSeek.



```js

const whitelist = \["ai", "gpt", "agent", "llm"];

const blacklist = \["funding", "politics", "lawsuit"];



function hardFilter(title) {

&#x20; const t = title.toLowerCase();

&#x20; if (!whitelist.some(w => t.includes(w))) return false;

&#x20; if (blacklist.some(b => t.includes(b))) return false;

&#x20; return true;

}

```



\### Batch AI filter



Il modello riceve 10 titoli in una sola chiamata e risponde con un array indicizzato.



```

Rispondi SOLO JSON valido.



Formato:

\[

&#x20; {"index": 0, "useful": true, "score": 8},

&#x20; {"index": 1, "useful": false, "score": 3}

]



Titoli:

0: {{title1}}

1: {{title2}}

...

```



Controllo indici mancanti dopo il parse:



```js

const expectedIndexes = batch.map((\_, i) => i);

const returnedIndexes = response.map(r => r.index);



expectedIndexes.forEach(i => {

&#x20; if (!returnedIndexes.includes(i)) {

&#x20;   console.warn(`Indice mancante nella risposta AI: ${i}`);

&#x20; }

});

```



\### Score filter



```js

if (!useful || score < 7) discard();

```



\### Struttura slide



```json

{

&#x20; "slides": \[

&#x20;   "HOOK",

&#x20;   "COSA E",

&#x20;   "PERCHE IMPORTA",

&#x20;   "AZIONE",

&#x20;   "ESEMPIO"

&#x20; ]

}

```



\### Validazione



```js

function isValid(slides) {

&#x20; return (

&#x20;   slides.length === 5 \&\&

&#x20;   slides.every(s => s.split(" ").length <= 8)

&#x20; );

}

```



Fallback con log e review queue:



```js

let attempts = 0;

let result;



while (attempts < 2) {

&#x20; result = generate();

&#x20; if (isValid(result.slides)) break;

&#x20; attempts++;

}



if (!isValid(result.slides)) {

&#x20; console.warn("FALLBACK TRIGGERED:", title);

&#x20; appendToReviewQueue(title, result);

&#x20; return;

}

```



\### Cache



```js

const hash = md5(normalize(title));

if (cache\[hash]) return cache\[hash];

```



\### Scheduling



```bash

0 \*/2 \* \* \* node run.js

```



Controllo automatico sulla review queue:



```js

const queue = JSON.parse(fs.readFileSync("review\_queue.json"));

if (queue.length > 10) {

&#x20; console.warn(`Review queue ha ${queue.length} elementi — controllare manualmente`);

}

```



\---



\## Frontend



\### Navigazione scroll snap



```css

.container {

&#x20; scroll-snap-type: y mandatory;

&#x20; overflow-y: scroll;

&#x20; height: 100vh;

}



.slide {

&#x20; scroll-snap-align: start;

&#x20; height: 100vh;

}

```



\### Visual design



```css

.slide {

&#x20; display: flex;

&#x20; align-items: center;

&#x20; justify-content: center;

&#x20; padding: 24px;

&#x20; font-size: 28px;

&#x20; font-weight: 600;

&#x20; text-align: center;

&#x20; line-height: 1.3;

}



.slide:nth-child(1) { background: #0f172a; color: #f8fafc; }

.slide:nth-child(2) { background: #1e293b; color: #f1f5f9; }

.slide:nth-child(3) { background: #334155; color: #f1f5f9; }

.slide:nth-child(4) { background: #475569; color: #f8fafc; }

.slide:nth-child(5) { background: #0f172a; color: #94a3b8; }

```



\### Regole UX minime



\- max 8 parole per slide, deve stare in 2-3 righe

\- testo sempre centrato

\- contrasto alto

\- niente scroll orizzontale



\---



\## Ottimizzazione costi



\- passare solo il titolo, mai l'articolo completo

\- batch da 10 titoli per chiamata

\- hard filter prima di qualsiasi chiamata AI

\- cache persistente su file

\- struttura output fissa, meno token di risposta



\---



\## Errori comuni da evitare



| Errore | Conseguenza | Soluzione |

|---|---|---|

| Usare Claude a runtime | Costo troppo alto | DeepSeek per produzione |

| Nessun hard filter | Costi AI esplodono | Filtrare prima di ogni chiamata |

| Output libero senza struttura | JSON rotto | Formato fisso e validazione |

| Nessuna cache | Paghi lo stesso articolo due volte | md5 su titolo normalizzato |

| Indici batch non verificati | Mappatura silenziosa sbagliata | Controllo indici attesi vs ricevuti |

| Review queue non monitorata | Fallback invisibili | Avviso automatico oltre 10 elementi |



\---



\## Struttura file



```

/

├── run.js

├── deepseek.js

├── fetch.js

├── filter.js

├── generate.js

├── validate.js

├── cache.json

├── review\_queue.json

├── .env

├── .gitignore

├── output/

├── logs/

└── frontend/

&#x20;   └── index.html

```



\---



\## Evoluzione futura



1\. Frontend scroll completo con design system

2\. Multi-nicchia (AI, finance, tech)

3\. API contenuti per distribuzione esterna

4\. Automazione completa con monitoring



\---



\## Principi guida



\- filtro > modello

\- struttura > creativita

\- UX > automazione

