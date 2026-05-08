# Visual AI Scroll Blog — Piano di Evoluzione

Continuazione del README. Parte da M14, dove il sistema è già funzionante e automatizzato.
Segui questo ordine. Completa e testa ogni milestone prima di passare alla successiva.

**Come usare con Claude Code:** all'inizio di ogni sessione incolla questo file + `CONTEXT.md` + `MANUAL.md` nel contesto, poi scrivi: *"Lavoriamo sulla M[N]"*.

---

## Stato attuale (2026-05-08)

| Milestone | Stato | Note |
|---|---|---|
| M14 — Riscrittura prompt slide | ✅ Completa | Hook narrativi, limite 8 parole, fallback ~8% |
| M16 — Output multi-formato | ✅ Completa | `generateFormats`, `thread_text`, `video_script` |
| M17 — Pagina di review | ✅ Completa | `review.html` dark theme, "Copia tutto", data relativa |
| Backfill formati | ✅ Completa | 75 da cache, 11 da API → 44 articoli unici |
| M15 — Frontend UX a due assi | ✅ Completa | Tutti i 7 scenari di test superati su mobile reale |
| Bug: cross-run dedup | ✅ Fix | Stesso articolo salvato 18x → ora 0 duplicati |
| Bug: GENERATE_FORMATS workflow | ✅ Fix | Aggiunto a `pipeline.yml`, formati ora generati in CI |
| Bug: ordinamento articoli | ✅ Fix | Articoli più recenti prima in `data.js` |
| Bug: data relativa | ✅ Fix | `timeAgo()` in `index.html` e `review.html`, `savedAt`/`pubDate` salvati |
| PRE-M21: fix prompt tensione irrisolta | ✅ Fix | `generateSlides` + `generateFormats` aggiornati, 45 articoli rigenerati |
| PRE-M21: link fonte negli articoli | ✅ Fix | `run.js` salva `link`; review + index mostrano "↗ Fonte" o "↗ Cerca" |
| M21b — Carousel Instagram | ✅ Completa | `carousel_slides` + `image_query`, Wikimedia per slide 2-5, `article.image` per slide 1, `carousel.html` 270×337px, `index.html` aggiornato. Full backfill 57 art. ⏳ |
| M21 — Test distribuzione reale | ⏳ Prossimo | Checkpoint obbligatorio prima di automatizzare canali |
| M22 — Iterazione prompt da dati | ⏳ Dopo M21 | Richiede 10-15 post pubblicati con dati reali |
| M18 — Ranking per qualità | ⏳ In attesa | Nice to have |
| M19 — Index globale articoli | ⏳ In attesa | Utile quando il volume cresce |
| M20 — Branding e URL pulito | ⏳ In attesa | - |

---

## Ordine di esecuzione

```
M14 ✅ → M16 ✅ → M17 ✅ → Backfill ✅ → M15 ✅ → PRE-M21 ✅ → M21b ✅
→ Full backfill ⏳ → M21 ← STOP: valuta risultati distribuzione (10-15 post)
→ M22 → M18 → M19 → M20
```

M14 e M16 sono le milestone più critiche. M21 è un checkpoint obbligatorio prima di automatizzare qualsiasi canale. M22 è quello che separa un progetto carino da un sistema che evolve.

---

## Milestone 14 — Riscrittura prompt slide

**Obiettivo:** slide con struttura narrativa invece di essere descrittive. È la modifica a più alto impatto sull'intero sistema — se sbagliata qui, tutto il resto è inutile.

Prompt per Claude Code:

```
Leggi generate.js e riscrivi il prompt inviato a DeepSeek per generateSlides(title).

Il nuovo prompt deve forzare questa struttura narrativa esatta:

Slide 1 — hook: domanda o affermazione che crea curiosità e fa venire voglia di leggere la slide 2
  Esempio DA FARE: "Questa AI può sostituire Excel?"
  Esempio DA NON FARE: "OpenAI rilascia nuovo modello"
  Regola dura: se la slide 1 è generica, informativa o non crea curiosità, rigenera prima di rispondere.
  Test interno: "questa slide fa venire voglia di leggere la prossima?" — se no, è sbagliata.

Slide 2 — contesto: una frase, massimo una informazione nuova

Slide 3 — punto sorprendente: la cosa che il lettore non si aspetta

Slide 4 — implicazione pratica: cosa cambia concretamente per chi legge

Slide 5 — takeaway: una frase finale netta, azione o riflessione

Regole invariate:
- max 8 parole per slide
- rispondi SOLO JSON valido nel formato { "slides": [...] }
- niente fluff, niente aggettivi generici

Aggiungi nel prompt 2 esempi completi: uno di output da non fare e uno da fare.

Dopo la modifica svuota cache.json con echo "{}" > cache.json
poi esegui node run.js e salva 10 output di esempio in una cartella test-output/.
```

**Test:** leggi a mano i 10 output. Se meno di 8 slide su 10 hanno un hook che crea tensione reale, riscrivere il prompt prima di andare avanti.

---

## Milestone 15 — Miglioramento frontend UX ✅ (2026-05-06)

> Viene dopo M16 e M17. L'UX non porta traffico e non valida l'idea — arriva solo dopo aver confermato che il contenuto funziona.
> ⚠️ Questa milestone riscrive completamente la struttura di `index.html` — non è un aggiornamento incrementale.

**✅ Risultato reale:** tutti e 7 gli scenari di test superati su Android Chrome e iPhone Safari.

**⚠️ Note implementazione (delta rispetto al piano originale):**
- `touch-action: pan-x pan-y` su `.story` (non `pan-x` separato) — altrimenti lo scroll verticale del feed viene bloccato
- Nessun `preventDefault()` nel touch handler — CSS scroll-snap gestisce tutto; JS interviene solo per l'edge case dell'ultima slide
- CSS variable `--slide-w` da `document.documentElement.clientWidth` (non `100vw`) — evita overflow orizzontale da scrollbar su Android
- `window.visualViewport.height` per `--vh` (non `window.innerHeight`) — correzione per address bar di Chrome Android
- Layout Instagram a 3 aree: `.slide-visual` (50%, gradiente colorato) + `.slide-content` (badge AI + titolo centrato su nero) + `.slide-info` (dot indicators + icone SVG + caption)
- `savedAt` salvato su ogni articolo; `timeAgo()` mostra data relativa in caption ("2h fa", "ieri")

**Obiettivo:** implementare il modello Stories + TikTok — swipe orizzontale per avanzare dentro la stessa notizia (slide 1→5), swipe verticale per cambiare notizia. Stesso "linguaggio" di Instagram Stories combinato con il feed verticale di TikTok.

**Modello UX:**
```
SWIPE ORIZZONTALE → slide successiva / precedente (stessa notizia)
SWIPE VERTICALE   → notizia successiva / precedente
```

**File da modificare:** `frontend/index.html`

Prompt per Claude Code:

```
Riscrivi completamente frontend/index.html con questa struttura a due assi.

STRUTTURA HTML:
- container esterno (.feed): scroll-snap verticale, un articolo per "pagina"
- container interno (.story): scroll-snap orizzontale, una slide per "pagina"
- ogni .story contiene 5 .slide da 100vw x 100vh

CSS base:
.feed {
  height: 100vh;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
}
.story {
  height: 100vh;
  width: 100vw;
  overflow-x: scroll;
  scroll-snap-type: x mandatory;
  display: flex;
}
.slide {
  min-width: 100vw;
  height: 100vh;
  scroll-snap-align: start;
  display: flex;
  align-items: center;
  justify-content: center;
}

GESTURE CONFLICT — pattern corretto (non usare preventDefault aggressivo):
Lascia che scroll-snap CSS faccia il lavoro principale di movimento.
Il JS serve solo per capire la direzione e aggiornare la UI — non per duplicare logica di scroll.

Aggiungi prima di tutto questo CSS su .story e .feed:
.story { touch-action: pan-x; }
.feed  { touch-action: pan-y; }
Questo aiuta il browser a non confondersi prima ancora che intervenga il JS.

Touch handler:
- touchstart → salva startX, startY, azzera direzione decisa
- touchmove:
    deltaX = currentX - startX
    deltaY = currentY - startY
    se direzione non ancora decisa:
      se |deltaX| > 10 o |deltaY| > 10 → decidi asse dominante (una volta sola)
      (usa 10px, non 15px — più reattivo su swipe veloci e corti)
    se direzione === 'horizontal' → chiama event.preventDefault() per bloccare verticale
    se direzione === 'vertical' → non fare nulla, lascia scorrere il .feed

Regole critiche:
- una volta decisa la direzione, non cambiarla per tutta la gesture
- non chiamare preventDefault() prima di aver deciso la direzione
- su iOS Safari: aggiungi il listener con { passive: false } altrimenti preventDefault è ignorato

INDICATORI VISIVI (obbligatori):
- 5 segmenti orizzontali in cima a ogni articolo
  aggiornali con scroll event sul .story usando scrollLeft / clientWidth
  formula stabile (evita Math.round che salta durante scroll lento):
  indiceAttivo = Math.floor((story.scrollLeft + story.clientWidth / 2) / story.clientWidth)
- prima slide del primo articolo: mostra testo "scorri →  altre news ↓"
  scompare dopo il primo swipe (variabile booleana in memoria)
- transizione orizzontale: scroll-snap gestisce tutto, non aggiungere animazioni CSS
- transizione verticale: snap immediato, nessuna animazione

RESET STATO TRA ARTICOLI (fondamentale):
Quando l'utente passa a un nuovo articolo, ogni .story deve ripartire da slide 1.
Usa IntersectionObserver sul .feed con soglia alta per evitare reset prematuri
durante lo scroll:
  observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
        entry.target.querySelector('.story').scrollLeft = 0;
      }
    });
  }, { threshold: 0.6 });
La soglia 0.6 garantisce che il reset avvenga solo quando l'articolo è davvero
attivo nel viewport — non mentre l'utente sta ancora scrollando.

EDGE CASE — ultima slide + swipe orizzontale:
Quando l'utente è sulla slide 5 e fa swipe → deve passare all'articolo successivo.
Implementa: se story.scrollLeft è al massimo e direzione === 'horizontal' e deltaX < 0
→ scorri il .feed all'articolo successivo programmaticamente (feed.scrollBy con behavior smooth).

PALETTE: mantieni i colori attuali (.slide-color-0..4)

Non usare librerie esterne. Solo HTML, CSS, JS puro.
```

**Test:** aprire su telefono reale (iPhone Safari + Android Chrome). Verificare questi scenari in ordine:
1. Scorrere tutte le 5 slide di un articolo — nessun jitter, snap fluido
2. Passare all'articolo successivo con swipe verticale — parte sempre da slide 1
3. Tornare indietro su entrambi gli assi
4. Swipe diagonale — sceglie un asse entro 10px e non cambia idea
5. Swipe veloce corto — deve comunque triggerare lo snap
6. Swipe lento diagonale — deve scegliere un asse e mantenerlo
7. Arrivare all'ultima slide e fare swipe orizzontale — non deve bloccare l'utente

---

## Milestone 16 — Output multi-formato

> Milestone critica — non è "aggiungere due campi". È la trasformazione del sistema in un content engine. Se i formati generati sono deboli, la distribuzione non parte. Investire tempo nel testing è obbligatorio.

**Obiettivo:** da ogni articolo generare testi pronti per Twitter/X thread e script per video breve, con qualità sufficiente per essere postati direttamente.

**File da modificare:** `generate.js`, `run.js`

Prompt per Claude Code:

```
In generate.js aggiungi una funzione generateFormats(title, slides) che:

- riceve il titolo e le 5 slide già generate
- chiama callDeepSeek() con questo prompt:

"Hai queste 5 slide su un articolo AI:
{{slides}}

Genera due formati. Rispondi SOLO JSON valido:

{
  "thread_text": [
    "tweet 1 — max 240 caratteri, tono diretto, funziona da solo senza contesto",
    "tweet 2",
    "tweet 3",
    "tweet 4",
    "tweet 5"
  ],
  "video_script": [
    "riga 1 — max 10 parole, come se stessi parlando a voce a un amico",
    "riga 2",
    "riga 3",
    "riga 4",
    "riga 5"
  ]
}

Regole thread:
- tweet 1 deve essere un hook forte che genera curiosità — non informativo, provocatorio
- tweet 2–4 sviluppano con progressione, NON ripetono le slide
- tweet 5 chiude con takeaway o implicazione concreta
- ogni tweet deve essere comprensibile da solo, ma il thread deve avere ritmo e progressione
- niente hashtag, niente emoji forzate
- tono: diretto, non giornalistico

Regole script:
- linguaggio parlato, non scritto
- niente sigle tecniche senza spiegazione"

- fa il parse della risposta
- restituisce { thread_text: [...], video_script: [...] }

Tieni questa funzione separata da generateSlides() — non estendere quel prompt.

In run.js, dopo generateSlides(), chiama generateFormats() solo se la variabile
d'ambiente GENERATE_FORMATS=true — questo permette di limitare il volume durante
il testing senza toccare il codice.

Aggiungi in .env: GENERATE_FORMATS=true

In run.js:
if (process.env.GENERATE_FORMATS === 'true') {
  const formats = await generateFormats(title, slides);
  // salva thread_text e video_script nel JSON di output e in data.js
}

Aggiungi anche validazione minima su generateFormats:
- wrap in try/catch
- se la risposta non è JSON valido o mancano i campi attesi, riprova 1 volta
- se fallisce ancora, logga console.warn("generateFormats fallito:", title) e restituisci null
- in run.js, se generateFormats restituisce null, salva l'articolo senza quei campi
  (non bloccare il run)
```

**Test:** esegui `node run.js`. Apri 10 JSON in `output/` e leggi ogni `thread_text`. Chiediti: "posterei questo?" — se la risposta è no più di 3 volte su 10, riscrivere il prompt di generateFormats prima di andare avanti.

---

## Milestone 17 — Pagina di review

> Milestone strategicamente sottovalutata: smetti di essere solo builder e diventi editor. È qui che capisci cosa è noioso, cosa è forte, cosa è postabile. Accelera la crescita più di qualsiasi altra feature nella fase iniziale.

**Obiettivo:** interfaccia locale per leggere rapidamente tutti i contenuti generati e copiarli in un click.

**File da creare:** `frontend/review.html`

Prompt per Claude Code:

```
Crea frontend/review.html — pagina separata, non linkata da index.html.

Legge window.ARTICLES da data.js (stesso meccanismo di index.html).

Per ogni articolo mostra in colonna:
- titolo originale in grassetto
- le 5 slide numerate
- sezione "Thread X" con i 5 tweet separati da linea
  + bottone "Copia tutto" che copia l'intero thread negli appunti
- sezione "Script video" con le 5 righe
  + bottone "Copia tutto"
- separatore orizzontale prima dell'articolo successivo

Stile:
- sfondo bianco, testo nero, font sans-serif leggibile
- layout a colonna singola, max-width 720px, centrato
- bottoni "Copia tutto": sfondo scuro, testo bianco, feedback visivo al click ("Copiato!")

Nessuna dipendenza esterna. Solo HTML, CSS, JS puro.

Aggiungi nel <head>:
- <meta name="viewport" content="width=device-width, initial-scale=1">
Su tutti gli elementi di testo del thread e dello script aggiungi:
- overflow-wrap: break-word
così la pagina è leggibile anche se aperta da telefono.
```

**Test:** aprire `review.html` nel browser. Valutare e copiare il thread di un articolo in meno di 30 secondi.

---

## Milestone 21 — Test di distribuzione reale

> Checkpoint obbligatorio. Non è una feature tecnica — è il momento in cui esci dal progetto e vai nel mondo reale. Solo dopo aver completato questa milestone ha senso automatizzare qualsiasi canale.

**Obiettivo:** capire empiricamente cosa funziona prima di automatizzare.

Prompt per Claude Code:

```
Crea un file test-distribuzione.md con questa struttura:

# Log distribuzione

## Piattaforma scelta
[X/Twitter oppure LinkedIn — scegliere una sola]

## Post

### Post 1
- Data:
- Titolo articolo:
- Thread usato: [incolla il testo]
- Impressioni:
- Engagement:
- Note:

[ripetere per 10 post]

## Insight dopo 10 post
1.
2.
3.

## Metriche minime
Un post è considerato funzionante se è tra i top 3 per engagement (impressioni, like, reply, repost).
Obiettivo minimo: identificare almeno 2 post che performano chiaramente meglio degli altri.
Se nessun post supera gli altri → il problema è nel contenuto, non nel canale. Torna a M14.

## Decisioni
- Prompt M14 da aggiornare? [sì/no + perché]
- Canale da automatizzare per primo: [X / LinkedIn / altro]
```

**Istruzioni operative (non per Claude Code):**
- Apri `review.html` e seleziona 10 articoli che sembrano forti
- Posta un thread al giorno sulla piattaforma scelta, usando i `thread_text` generati in M16
- Compila `test-distribuzione.md` dopo ogni post
- Dopo 10 post, rispondi alle tre domande nella sezione "Insight"

**Test:** `test-distribuzione.md` compilato con 10 post e 3 insight scritti. Decisione documentata su quale canale automatizzare.

> ⛔ **Gate obbligatorio:** non si passa a M22 finché `test-distribuzione.md` non contiene almeno 10 post pubblicati con dati reali. Creare il file senza pubblicare non conta.

---

## Milestone 22 — Iterazione prompt da dati reali

> È qui che succede il salto: intuizione → dati → iterazione. Senza questa milestone il sistema produce, ma non migliora mai. È quello che separa un progetto carino da un sistema che evolve.

**Obiettivo:** riscrivere il prompt di M14 usando feedback reale dai 10 post pubblicati in M21 — non intuizioni, dati.

**File da modificare:** `generate.js`

Prompt per Claude Code:

```
Leggi ./test-distribuzione.md dalla root del progetto e identifica:
- quali hook (slide 1) hanno generato più engagement
- quali pattern ricorrono nei post che hanno funzionato
- quali argomenti o formulazioni sono stati ignorati

Sulla base di questi dati, riscrivi il prompt in generateSlides() in generate.js.

Documenta le modifiche aggiungendo un commento in cima alla funzione:

// PROMPT v2 — aggiornato dopo M22
// Cosa è cambiato rispetto a v1:
// - [modifica 1 + motivazione basata su dato reale]
// - [modifica 2 + motivazione]
// Data: [data della modifica]

Dopo la modifica:
- svuota cache.json con echo "{}" > cache.json
- esegui node run.js
- salva 10 nuovi output in test-output-v2/
```

**Test:** confronta `test-output/` (v1) con `test-output-v2/` (v2). Almeno 8 hook su 10 devono essere percettibilmente più forti di quelli precedenti. Il commento nel codice deve spiegare perché — non solo cosa è cambiato.

---

## Milestone 18 — Ranking articoli per qualità

> Nice to have — non cambia il destino del progetto. Puoi rimandare senza conseguenze se hai poco tempo.

**Obiettivo:** mostrare prima gli articoli migliori invece dell'ordine cronologico.

**File da modificare:** `run.js`

Prompt per Claude Code:

```
In run.js, prima di scrivere frontend/data.js, ordina gli articoli per score decrescente.

- usa il campo score già presente nel JSON di output (da batchAIFilter in filter.js)
- in caso di parità, ordina per pubDate decrescente (più recente prima)
- se score non è presente su un articolo, trattalo come 0

Non modificare filter.js — solo l'ordinamento in run.js prima della scrittura di data.js.
```

**Test:** `node run.js`, poi aprire il sito. Gli articoli con score più alto devono apparire per primi.

---

## Milestone 19 — Index globale articoli

> Utile per il futuro — non urgente ora. Serve quando il volume rende difficile gestire i JSON separati manualmente.

**Obiettivo:** file unico che traccia tutti gli articoli mai processati.

**File da creare:** `output/index.json`

Prompt per Claude Code:

```
In run.js, dopo aver salvato ogni JSON in output/, aggiorna output/index.json.

Struttura di index.json: array di oggetti
{ slug, title, pubDate, score, processedAt }

Regole:
- se index.json non esiste, crealo con array vuoto
- usa slug come chiave — non aggiungere articoli già presenti
- i file JSON singoli in output/ rimangono invariati

Aggiungi la scrittura di index.json alla fine del flusso in run.js,
dopo il riepilogo finale a console.
```

**Test:** `node run.js` due volte. `output/index.json` non deve avere duplicati.

> 📌 **Nota crescita:** dopo circa una settimana di run automatici, `data.js` può contenere centinaia di articoli caricati tutti in memoria dal browser. Quando il volume inizia a pesare, limita `data.js` agli ultimi 50 articoli aggiungendo uno slice in `run.js` prima di scrivere il file: `articles.slice(-50)`.

---

## Milestone 20 — Branding e URL pulito

**Obiettivo:** identità minima riconoscibile — nome, favicon, meta tag.

**File da modificare:** `frontend/index.html`, `package.json`

Prompt per Claude Code:

```
Aggiungi a frontend/index.html:
- <title>AISnap</title>  (o il nome scelto — cambia il placeholder)
- <meta name="description" content="Le news AI in 5 slide. Aggiornato ogni 2 ore.">
- <meta name="viewport" content="width=device-width, initial-scale=1">
- favicon inline SVG nel <head>:
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>">

Nell'ultima slide (slide 5) di ogni articolo aggiungi in basso a destra
il nome del sito in piccolo: "AISnap" con opacity 0.4, font-size 12px.

In package.json verifica che lo script "start" esegua node server.js
(non node run.js — server.js è il processo sempre attivo su Railway).
```

**Test:** aprire il sito su mobile. Verificare che nella tab del browser appaia il nome e l'emoji ⚡.

---

## Guida ai test manuali

Questa sezione raccoglie tutto quello che devi fare tu — non Claude Code.
Per ogni milestone che richiede un test manuale trovi le istruzioni passo per passo.

---

### Test M14 — Qualità hook delle slide

Dopo che Claude Code ha riscritto il prompt e girato `node run.js`:

1. Apri la cartella `test-output/` nel tuo editor o file manager
2. Apri i 10 file JSON uno per uno
3. Per ogni file guarda solo il primo elemento dell'array `slides` (la slide 1)
4. Chiediti: *"questa frase mi fa venire voglia di leggere la prossima?"*
5. Segna mentalmente sì o no
6. Se hai meno di 8 sì su 10 → torna a Claude Code e chiedi di migliorare il prompt prima di andare avanti

**Cosa cercare in un hook buono:**
- fa una domanda che non puoi ignorare ("Questa AI può sostituire il tuo lavoro?")
- afferma qualcosa di sorprendente o controintuitivo
- crea una tensione che si risolve solo leggendo la slide 2

**Cosa scartare:**
- titoli descrittivi ("OpenAI lancia nuovo modello")
- affermazioni ovvie ("L'AI sta crescendo")
- qualsiasi cosa che potresti leggere su un titolo di giornale

---

### Test M15 — UX mobile a due assi

Questo test va fatto su telefono reale, non sul browser desktop.
Hai bisogno di iPhone Safari oppure Android Chrome — idealmente entrambi.

Prima di iniziare: assicurati che Railway abbia fatto il deploy dell'ultima versione (aspetta ~1 minuto dopo il push).

Esegui questi scenari in ordine, uno per volta:

**Scenario 1 — Scroll orizzontale base**
Apri il sito. Fai swipe verso sinistra sulla prima slide.
Atteso: vai alla slide 2 della stessa notizia, fluido, senza jitter.

**Scenario 2 — Reset al cambio articolo**
Avanza fino alla slide 4 di un articolo. Poi fai swipe verso il basso.
Atteso: il nuovo articolo parte dalla slide 1, non dalla 4.

**Scenario 3 — Ritorno indietro**
Dalla slide 3, fai swipe verso destra.
Atteso: torni alla slide 2. Poi swipe verso l'alto: torni all'articolo precedente.

**Scenario 4 — Swipe diagonale**
Fai uno swipe a 45 gradi (né orizzontale né verticale).
Atteso: il sistema sceglie un asse entro i primi millimetri e non cambia idea.

**Scenario 5 — Swipe veloce e corto**
Fai un tocco rapido e breve verso sinistra, quasi un tap.
Atteso: lo snap viene comunque triggerato, non rimane a metà.

**Scenario 6 — Ultima slide**
Arriva alla slide 5 di un articolo. Fai swipe verso sinistra.
Atteso: passa all'articolo successivo (non si blocca, non rimane ferma).

**Scenario 7 — Indicatori**
Scorri le 5 slide di un articolo osservando i segmenti in cima.
Atteso: il segmento attivo si aggiorna in modo preciso a ogni slide, senza lag.

Se uno qualsiasi di questi scenari fallisce → segnalalo a Claude Code descrivendo esattamente cosa è successo e su quale device.

---

### Test M16 — Qualità dei formati generati

Dopo che Claude Code ha implementato `generateFormats` e girato `node run.js`:

1. Apri 10 file JSON in `output/` e leggi il campo `thread_text` di ognuno
2. Per ogni thread chiediti: *"posterei questo su X adesso, così com'è?"*
3. Conta i no
4. Se hai più di 3 no su 10 → torna a Claude Code e chiedi di migliorare il prompt di `generateFormats`

**Cosa cercare in un thread buono:**
- il tweet 1 è provocatorio o fa una domanda che crea curiosità
- i tweet 2-4 aggiungono informazioni nuove, non ripetono
- il tweet 5 chiude con qualcosa di memorabile o azionabile
- ogni tweet ha un tono diretto, non da comunicato stampa

**Cosa scartare:**
- tweet 1 che inizia con "Recentemente..." o "Un nuovo studio mostra..."
- tweet che ripetono le stesse parole delle slide
- tono passivo o accademico

Controlla anche il campo `video_script`: leggi le 5 righe ad alta voce.
Se suonano come testo scritto anziché parlato → segnala anche questo.

---

### Test M17 — Pagina di review

Apri `frontend/review.html` direttamente nel browser (non serve Railway, basta aprire il file in locale dopo aver caricato `data.js`).

1. Verifica che tutti gli articoli siano visibili con titolo, slide, thread e script
2. Clicca "Copia tutto" sul thread del primo articolo
3. Incolla in un editor di testo e verifica che il contenuto sia completo e formattato correttamente
4. Ripeti con lo script video
5. Apri la pagina anche da telefono e verifica che sia leggibile

Cronometra: dal momento in cui apri la pagina a quando hai copiato il thread del primo articolo non devono passare più di 30 secondi.

---

### Test M21 — Distribuzione reale (il test più importante)

Questo non è un test tecnico. È il momento in cui smetti di costruire e inizi a capire se quello che hai costruito funziona.

**Preparazione (una volta sola):**
1. Scegli una piattaforma: X/Twitter oppure LinkedIn — solo una
2. Apri `review.html` e leggi tutti gli articoli disponibili
3. Seleziona i 10 che ti sembrano più forti — quelli con un hook che ti colpisce davvero

**Ogni giorno per 10 giorni:**
1. Prendi il `thread_text` dell'articolo selezionato da `review.html`
2. Postalo sulla piattaforma scelta (puoi adattare leggermente se necessario, ma non riscrivere)
3. Dopo 24 ore annota in `test-distribuzione.md`: impressioni, like, reply, repost
4. Scrivi una riga di note su cosa hai notato — anche "niente di particolare" è un dato

**Dopo 10 giorni:**
1. Rileggi tutto il log
2. Identifica i 2-3 post che hanno performato meglio degli altri
3. Chiediti: cosa avevano in comune? L'argomento? Il tono? Il formato del hook?
4. Rispondi alle domande nella sezione "Decisioni" di `test-distribuzione.md`
5. Solo dopo vai a M22

**Segnale di allarme:** se nessun post ha performato meglio degli altri in modo distinguibile, non andare avanti — il problema è nel contenuto. Torna a Claude Code con i dati e lavorate insieme sul prompt.

---

### Test M22 — Confronto v1 vs v2

Dopo che Claude Code ha riscritto il prompt e generato `test-output-v2/`:

1. Apri `test-output/` (v1) e `test-output-v2/` (v2) affiancati
2. Leggi le slide 1 di ogni articolo in entrambe le versioni
3. Per ogni coppia chiediti: quale hook è più forte?
4. Se v2 vince almeno 8 confronti su 10 → la milestone è completata
5. Leggi il commento `// PROMPT v2` in `generate.js` e verifica che le motivazioni siano specifiche e basate su dati reali (non generiche come "migliorato il tono")

---



- I file sorgente si trovano nella root del repo (o `/home/miki/visual-scroll-blog/`)
- Prima di modificare `generate.js` o `filter.js`: `echo "{}" > cache.json`
- Per testare senza GitHub Actions: `node run.js`
- Per vedere i log dell'ultimo run: `tail -50 logs/run.log`
- Il frontend va online solo dopo `git push` (Railway autodeploy ~1 minuto)
- Il server su Railway esegue `server.js`, non `run.js` — non confonderli
- Per testare M16: verificare che `.env` contenga `GENERATE_FORMATS=true` — senza questo flag `generateFormats` non viene chiamato e i campi `thread_text` e `video_script` non vengono generati
