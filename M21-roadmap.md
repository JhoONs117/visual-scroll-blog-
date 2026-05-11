# Roadmap M21 — Test Distribuzione Reale

Stato: M21b ✅ COMPLETA — Step A ✅ A.5 ✅ B ✅ C ✅ D ✅ E ✅ — Pexels ✅ — Download PNG ✅  
Aggiornato: 2026-05-11

---

## FASE 0 — Obiettivo corretto

NON stiamo cercando follower, viralità o monetizzazione.  
Stiamo cercando:

- Pattern di hook che fermano il lettore
- Temi AI che generano attenzione reale
- Formato migliore (carousel / reel / thread / video)
- Segnali di retention autentici (bookmark, reply, tempo di permanenza)

Questo cambia radicalmente l'interpretazione dei numeri.

---

## PRE-M21 — Intervento prompt ✅ (2026-05-07)

**Completato prima di pubblicare qualsiasi thread su X.**

L'analisi su 3 articoli reali (governance AI agent, CopilotKit, Fervo Energy) ha evidenziato tre problemi strutturali. Tutti e tre risolti.

### Problema 1 — Le slide sono titoli di giornale, non micro-hook ✅
**Fix applicato:** aggiunto in `generateSlides()` vincolo esplicito "tensione irrisolta": ogni slide deve contenere una domanda aperta o informazione incompleta che si chiude solo nella slide successiva.

### Problema 2 — I thread finiscono con frasi valutative vuote ✅
**Fix applicato:** prompt `generateFormats` aggiornato — tweet 5 deve chiudere con un fatto netto, conseguenza concreta o domanda aperta.

### Problema 3 — Il thread non amplifica le slide, le riscrive da zero ✅
**Fix applicato:** prompt `generateFormats` aggiornato — il modello sceglie come tweet 1 la slide con più tensione narrativa indipendentemente dalla posizione.

### Risultati verificati sui 3 articoli di test
- **Governance AI**: slide 1 "Chi decide quando un agente AI dice stop?" ✅ — tweet 1 usa slide 3 (kill switch) ✅ — tweet 5 "Testa il tuo kill switch oggi" ✅
- **CopilotKit**: tweet 1 usa slide 3 ("sviluppatori già in produzione") ✅ — tweet 5 "meno di dieci righe di codice" ✅
- **Fervo Energy**: tweet 1 usa slide 3 (fracking per geotermico) ✅ — tweet 5 "Costa meno di un tetto solare, produce 24h su 24" ✅

**Criteri superati:** 3/3 su tweet 1 e tweet 5. Si procede con M21.

### Rigenerazione completa ✅
`regenerate-all.js` ha rigenerato tutti i 45 articoli esistenti con i nuovi prompt: **45/45 OK, 0 fallimenti**.

---

## M21 — Test distribuzione reale su X/Twitter

**Obiettivo:** pubblicare 15 thread reali su X, raccogliere dati, identificare pattern di hook.  
**Durata:** 15 giorni, 1 thread al giorno.  
**Priorità assoluta:** iniziare a pubblicare subito — nessun lavoro tecnico blocca questa fase.

> M21b (template carousel) è separata e parte dopo i primi 5 thread. Non è un prerequisito per pubblicare su X.

---

### Preparazione account (una volta sola)

**Prompt da dare a Claude Code:**

```
Non serve codice per questo step.

Crea un file test-distribuzione.md nella root del progetto con questa struttura:

# Test Distribuzione M21

Piattaforma: X/Twitter
Orario fisso di pubblicazione: ___
Data inizio: ___

## Coda articoli (da compilare prima di iniziare)

| # | Titolo articolo | Hook (Tweet 1) | Tipo hook | Note pre-pubblicazione |
|---|-----------------|----------------|-----------|------------------------|
| 1 | | | | |
...fino a 15

## Log pubblicazioni

| Thread | Data | Hook (Tweet 1) | Slide origine | Hook type | Impression | Bookmark | Reply | Repost | Note |
|--------|------|----------------|---------------|-----------|------------|----------|-------|--------|------|
| 1 | | | | | | | | | |
...fino a 15

## Pattern vincenti
(da compilare dopo 15 post)

### Hook che hanno performato
-

### Hook che non hanno funzionato
-

### Topic migliori
-

### Topic peggiori
-

### Slide origine più frequente per tweet 1
-

### Decisioni per M22
-
```

**Test manuale — preparazione:**
1. Crea l'account X — compila bio e foto profilo in modo coerente con il tema AI news
2. Apri `review.html` e leggi tutti gli articoli disponibili
3. Seleziona 15 articoli con l'hook (Tweet 1) più forte — quelli che ti colpiscono davvero
4. Compila la colonna "Coda articoli" in `test-distribuzione.md`
5. Scegli un orario fisso di pubblicazione e annotalo — mantienilo per tutti i 15 giorni

---

### Ogni giorno per 15 giorni

1. Apri `review.html`
2. Copia il `thread_text` dell'articolo del giorno
3. Postalo su X — puoi correggere errori grammaticali, non riscrivere la struttura
4. Dopo 24 ore annota nel log: impression, bookmark, reply, repost
5. Scrivi una riga di note — anche "niente di particolare" è un dato

**Cosa guardare in ogni post:**
- **Bookmark:** il segnale più forte — significa "voglio rileggere questo"
- **Reply:** qualcuno ha qualcosa da dire — positivo anche se critico
- **Impression:** reach algoritmico, utile ma secondario rispetto ai bookmark
- **Profile visit da quel tweet:** interesse sull'autore, non solo sul contenuto

**Attenzione al rumore iniziale:**
- I primi 2–3 thread su account nuovo avranno reach molto bassa (spesso sotto 50 impression)
- Non scartare un hook solo perché il thread n.2 è andato male — aspetta almeno 5-6 post
- Usa nei primi 2 giorni gli hook più forti emersi dai test offline

---

### Criterio di stop anticipato

Se dopo 5 thread si registrano 0 bookmark e 0 reply su tutti e 5, si interviene prima della fine:

| Scenario | Causa probabile | Azione |
|----------|----------------|--------|
| Impression < 30 su tutti | Account troppo nuovo, nessun warm-up | Aspetta altri 5 giorni, riposta il thread migliore |
| Impression OK ma 0 bookmark | Hook deboli o topic sbagliato | Porta i 5 hook peggiori a Claude Code — revisione prompt |
| Impression OK ma 0 reply | Tono troppo passivo o generico | Cambia categoria (es. da governance AI a coding AI pratico) |

---

### Dopo 15 giorni — analisi pattern

1. Ordina il log per bookmark (non per impression)
2. Identifica i 2–3 post con più bookmark — cosa avevano in comune?
   - Argomento? (coding AI / agenti / lavoro / costi / confronto modelli)
   - Tipo di hook? (domanda / numero sorprendente / conseguenza personale / contrasto)
   - Slide di origine? (slide 1, 3 o 5?)
   - Tono? (diretto / provocatorio / pratico)
3. Compila la sezione "Pattern vincenti" in `test-distribuzione.md`
4. Solo dopo vai a M22

---

## M21b — Preparazione template carousel (dopo i primi 5 thread)

**Obiettivo:** aggiungere `carousel_slides` al JSON degli articoli e creare `frontend/carousel.html` come pagina separata per il template dark tech Instagram.

> Questo non tocca `slides[]`, `thread_text`, `video_script`, `index.html`, né `review.html`. Il cuore del sistema resta invariato.

**Immagine di riferimento del template:**
```
\\wsl$\Ubuntu\home\miki\visual-scroll-blog\template carousel.png
```
Carousel reale già generato dal sistema, basato sulla notizia *"Google unveils Whoop-like screenless Fitbit Air"*. Mostra le 5 slide complete con palette dark tech, badge AI NEWS, hook, description, immagine prodotto e footer. È il target visivo per tutto M21b — in caso di dubbio su layout, colori o gerarchia, questo file è la fonte di verità.

### Struttura JSON target

```json
{
  "title": "...",
  "link": "...",
  "image": "https://...",
  "slides": ["...", "...", "...", "...", "..."],
  "thread_text": ["...", "...", "...", "...", "..."],
  "video_script": ["...", "...", "...", "...", "..."],
  "carousel_slides": [
    { "hook": "...", "description": "...", "visual_hint": "...", "layout_type": "hero",        "icon": "tag"       },
    { "hook": "...", "description": "...", "visual_hint": "...", "layout_type": "right-focus", "icon": "waves"     },
    { "hook": "...", "description": "...", "visual_hint": "...", "layout_type": "sensor-zoom", "icon": "heart"     },
    { "hook": "...", "description": "...", "visual_hint": "...", "layout_type": "human-hand",  "icon": "vibration" },
    { "hook": "...", "description": "...", "visual_hint": "...", "layout_type": "cta-final",   "icon": "tag"       }
  ]
}
```

**Architettura visiva:**
- `article.image` — foto reale dell'articolo (da `og:image`), base comune per tutte e 5 le slide
- `layout_type` — controlla crop, posizione e composizione dell'immagine in ogni slide
- `icon` — icona SVG inline che accompagna la description, diversa per slide
- `carousel.html` — applica crop/overlay/glow/posizionamento via CSS puro, nessuna AI generativa

**Perché questa architettura:**  
stessa immagine base → brand consistency garantita  
layout diverso per slide → varietà visiva, swipe continuation, percezione premium  
icona per slide → rinforza il focus narrativo  
tutto in HTML/CSS → stabile, veloce, zero dipendenze esterne

**Layout types:**

| layout_type | Composizione |
|-------------|--------------|
| `hero` | immagine centrale dominante, nessun crop |
| `right-focus` | testo a sinistra, immagine allineata a destra |
| `sensor-zoom` | crop centrale 2x, dettaglio ravvicinato |
| `human-hand` | immagine in basso a destra, overlay scuro in alto |
| `cta-final` | immagine floating con glow blu, accent amplificato |

**Icon set (SVG inline, colore #3B82F6):**

| icon | Significato |
|------|-------------|
| `tag` | label / etichetta |
| `waves` | onde tattili / segnale |
| `heart` | battito cardiaco |
| `vibration` | vibrazione / polso |
| `check` | conferma / risultato |

> `article.image` viene estratto dall'`og:image` della pagina originale. Se non trovato, ogni layout usa uno sfondo radiale dark tech al posto della foto.

### Struttura file frontend (invariata)

```
frontend/index.html       → esperienza utente mobile (non toccare)
frontend/review.html      → editor/copia contenuti (non toccare)
frontend/carousel.html    → template IG 1080x1350 in preview 4:5 (nuovo)
```

---

### Step A — Aggiungi `carousel_slides` a `generate.js` ✅ (2026-05-08)

**Completato.** `generateCarouselSlides(title, slides, thread_text)` aggiunta in `generate.js`.

Differenze rispetto alla spec originale:
- Accetta `thread_text` come terzo parametro opzionale: se presente, i tweet vengono inclusi nel prompt come base per le `description` di ogni slide (contenuto più ricco, niente testo inventato)
- `icon` scelto dall'AI tra il set valido (non fisso per posizione)
- Validazione: layout_type fisso per posizione + icon deve essere nel set valido

`run.js` aggiornato: chiama `generateCarouselSlides(result.title, result.slides, result.thread_text)` dopo `generateFormats()`, solo se `GENERATE_FORMATS=true`.

**Prompt originale da dare a Claude Code:**

```
Leggi generate.js.

Aggiungi una nuova funzione generateCarouselSlides(title, slides) separata da generateSlides().

La funzione:
- riceve il titolo dell'articolo e l'array slides[] già generato (array di stringhe)
- chiama callDeepSeek() con questo prompt:

"Dato questo titolo e queste 5 slide, genera 5 carousel_slides per Instagram.

Titolo: {{title}}
Slide:
1. {{slides[0]}}
2. {{slides[1]}}
3. {{slides[2]}}
4. {{slides[3]}}
5. {{slides[4]}}

Rispondi SOLO JSON valido nel formato:
{
  \"carousel_slides\": [
    { \"hook\": \"max 8 parole\", \"description\": \"max 25 parole\", \"visual_hint\": \"max 6 parole\", \"layout_type\": \"hero\",        \"icon\": \"tag\"       },
    { \"hook\": \"...\",           \"description\": \"...\",          \"visual_hint\": \"...\",          \"layout_type\": \"right-focus\", \"icon\": \"waves\"     },
    { \"hook\": \"...\",           \"description\": \"...\",          \"visual_hint\": \"...\",          \"layout_type\": \"sensor-zoom\", \"icon\": \"heart\"     },
    { \"hook\": \"...\",           \"description\": \"...\",          \"visual_hint\": \"...\",          \"layout_type\": \"human-hand\",  \"icon\": \"vibration\" },
    { \"hook\": \"...\",           \"description\": \"...\",          \"visual_hint\": \"...\",          \"layout_type\": \"cta-final\",   \"icon\": \"tag\"       }
  ]
}

Regole testo:
- hook: max 8 parole, tensione irrisolta, non titolo di giornale
- description: max 25 parole, aggiunge info che non è nell'hook
- visual_hint: max 6 parole — elemento visivo concreto coerente con il layout della slide
- slide 1 deve avere l'hook con più tensione (può venire dalla slide 3 o 5 originale)

Regole layout_type — assegna sempre in questo ordine fisso:
- slide 1: layout_type sempre \"hero\"
- slide 2: layout_type sempre \"right-focus\"
- slide 3: layout_type sempre \"sensor-zoom\"
- slide 4: layout_type sempre \"human-hand\"
- slide 5: layout_type sempre \"cta-final\"

Regole icon — scegli il più pertinente al contenuto della slide tra:
tag, waves, heart, vibration, check

Nessun testo fuori dal JSON."

- fa il parse della risposta
- valida che carousel_slides abbia esattamente 5 elementi
  con i campi: hook, description, visual_hint, layout_type, icon
- layout_type deve essere uno tra: hero, right-focus, sensor-zoom, human-hand, cta-final
- in caso di errore: 1 retry, poi restituisce null (non blocca la pipeline)
- restituisce { carousel_slides } oppure null

In run.js aggiungi la chiamata a generateCarouselSlides() dopo generateFormats(),
solo se GENERATE_FORMATS=true in env.
Se restituisce null, l'articolo viene salvato comunque senza il campo carousel_slides.

Esporta la funzione con module.exports.

NON modificare generateSlides(), validateWithFallback(), slides[], thread_text, video_script.
```

**Test manuale dopo Step A:**
```bash
node run.js
```
Apri 3 file JSON appena creati in `output/`. Verifica:
- `carousel_slides` è un array di 5 oggetti con i campi: `hook`, `description`, `visual_hint`, `layout_type`, `icon`
- I 5 `layout_type` sono nell'ordine fisso: hero → right-focus → sensor-zoom → human-hand → cta-final
- `slides[]` originale è ancora un array di stringhe — non è stato toccato
- `thread_text` e `video_script` sono ancora presenti e intatti

---

### Step A.5 — Aggiungi `image` al JSON degli articoli ✅ (2026-05-08)

**Completato** — parzialmente diverso dalla spec originale.

`fetchArticleImage(url)` implementata direttamente in `backfill-carousel.js` (non in `fetch.js` come indicato nella spec). Usa `fetch()` nativo di Node 22 invece di axios. Cerca `og:image` e `twitter:image` con gestione di entrambi gli ordini degli attributi. Timeout: 8000ms.

Non è stata integrata in `run.js` per i nuovi articoli — viene applicata via backfill. Da valutare in M22 se aggiungerla al pipeline automatico.

Test: 2/2 articoli trovati con immagine da TechCrunch CDN.

**Perché:** l'immagine di ogni card carousel deve essere la foto reale dell'articolo originale — quella che l'editore ha scelto per rappresentare la notizia. È coerente con il contenuto, non generata casualmente, e funziona per tutte e 5 le slide dello stesso articolo (stessa foto = carousel visivamente unitario).

**Come funziona:** ogni articolo ha già il campo `link` (URL della pagina originale). Basta fare una GET a quell'URL ed estrarre il tag `<meta property="og:image">` — è presente su quasi tutti i siti di news.

**Prompt da dare a Claude Code:**

```
Leggi fetch.js e run.js.

In fetch.js aggiungi una funzione fetchArticleImage(url) che:
- fa una GET all'URL della pagina articolo con axios (timeout: 5000ms)
- cerca nel body HTML il tag: <meta property="og:image" content="...">
- restituisce il valore del content (URL immagine) oppure null se non trovato
- gestisce tutti gli errori con try/catch senza bloccare mai la pipeline
- non segue redirect infiniti: usa maxRedirects: 3 in axios

Esporta la funzione con module.exports.

In run.js, dopo il filtro AI e prima di generateSlides():
- per ogni articolo che ha superato i filtri, chiama fetchArticleImage(article.link)
- salva il risultato come campo "image" nell'oggetto articolo
- se null → il campo non viene aggiunto, nessun log di errore (è normale)
- logga solo il contatore finale: "Immagini trovate: N / totale articoli"

Il campo "image" viene incluso nel JSON salvato in output/ e in frontend/data.js.

NON modificare la logica di filtro, generateSlides(), generateFormats(), generateCarouselSlides().
```

**Test manuale dopo Step A.5:**
```bash
node run.js
```
Apri 5 file JSON in `output/`. Verifica:
- Almeno 3 su 5 hanno il campo `image` con un URL che inizia con `https://`
- Apri uno degli URL immagine nel browser — deve caricare la foto dell'articolo
- I file senza `image` non hanno errori nel JSON — il campo è semplicemente assente

---

### Step B — Backfill `carousel_slides` e `image` sugli articoli esistenti ✅ parziale (2026-05-08)

**Script creato e testato sui 2 articoli di test.** Risultato test:
- carousel_slides: Aggiornati 0 | Già presenti 2 | Falliti 0
- image: Trovate 2/2 (Airbnb + Power grid da TechCrunch CDN)

**Testato su 2 articoli ✅ — pronto per il full backfill (57 articoli) ⏳**

Per eseguire il backfill completo: `node backfill-carousel.js` senza argomenti.
Filtro per slug specifici: `node backfill-carousel.js airbnb the-biggest`

Nota: `backfill-carousel.js` gestisce ora tre step in sequenza per ogni articolo:
1. Genera `carousel_slides` se assenti (DeepSeek, include `image_query` per slide)
2. Fetcha immagini Wikimedia per slide 2-5 usando `cs.image_query`
3. Fetcha `article.image` (og:image) per slide 1 dal sito sorgente

**Prompt originale da dare a Claude Code:**

```
Aggiorna backfill-carousel.js (o crealo se non esiste) in modo che gestisca
sia carousel_slides che il campo image sugli articoli esistenti.

Il file:
1. Legge tutti i JSON in output/ — prende un file per slug (il più recente, stessa logica di backfill.js)
2. Per ogni articolo unico:
   a. Se non ha carousel_slides → chiama generateCarouselSlides(title, slides)
      Se il risultato è valido → aggiorna il JSON aggiungendo carousel_slides
      Se restituisce null → logga "SKIP carousel: {{title}}" e continua
   b. Se non ha image e ha link → chiama fetchArticleImage(link)
      Se trova un URL → aggiorna il JSON aggiungendo image
      Se null → salta silenziosamente
   c. Se ha già entrambi i campi → salta senza fare nulla
3. Al termine ricostruisce frontend/data.js
4. Stampa un riepilogo:
   "carousel_slides — Aggiornati: N | Già presenti: N | Falliti: N"
   "image — Trovate: N | Non trovate: N"

Esegui: node backfill-carousel.js
```

**Test manuale dopo Step B:**
- Verifica il riepilogo: `carousel_slides` falliti idealmente 0; `image` trovate idealmente > 30 su 45
- Apri `frontend/data.js` e controlla i primi 3 articoli: hanno `carousel_slides` e `image`?
- Apri uno degli URL in `image` nel browser — carica la foto corretta?
- Apri `index.html` e `review.html` — devono funzionare normalmente, invariati

---

### Step C — Crea `frontend/carousel.html` ✅ (2026-05-08)

**Implementato** — preview 270×337px (4:5), layout dark tech, Inter 900.

**Implementazione reale (diverge dalla spec originale 1080×1350px):**
- Dimensioni: 270×337px preview (non 1080×1350px come da spec — scelta deliberata per praticità)
- 5 layout CSS: hero, right-focus, sensor-zoom, human-hand, cta-final con gradiente dark dedicato
- **Slide 1** → `article.image` (og:image dal sito sorgente) come sfondo con overlay dark
- **Slide 2-5** → immagine Wikimedia Commons ricercata con `cs.image_query` generata da DeepSeek
- Overlay dark adattivo: `rgba(6,10,22, 0.78/0.62/0.85)` sulle slide con immagine
- Fallback: gradiente dark tech per slide senza immagine
- Orb radiale per profondità visiva (slide-specific)
- Deco-icon: SVG 130px faint in angolo, posizione per layout
- Badge dinamico: `sourceFromLink(article.link)` → "TechCrunch", "AI News", ecc.
- `accentHook()`: split su `:` o `—`, fallback su ultima ~45% delle parole → span cyan
- Handle: `@FlashAI`
- Dropdown selector articolo + thread preview in fondo
- Accent color: #3B82F6, Inter Google Fonts (weight 400/700/800/900)
- Filtri qualità Wikimedia: esclude PDF/SVG/loghi/ritratti, richiede ≥2 parole query nel filename

**index.html aggiornato:** `article.image` come `background-image` su `.slide-visual` (50% superiore della card), fallback al gradiente dark per articoli senza immagine.

**Obiettivo:** pagina di export per Instagram. Ogni card è **1080×1350px** reali, pronta per screenshot. Usa `article.image` come foto base e applica un layout diverso per ogni slide tramite CSS puro — stessa immagine, 5 composizioni diverse, identità visiva coerente.

> Niente Pollinations, niente generazione casuale, niente immagine identica ripetuta.  
> `layout_type` controlla crop/posizione/overlay. `icon` aggiunge l'elemento grafico per slide.  
> L'AI ha già deciso la direzione visiva. HTML/CSS crea la varietà.

**Riferimento visivo per Claude Code:** prima di scrivere una riga di codice, apri questa immagine:
```
\\wsl$\Ubuntu\home\miki\visual-scroll-blog\template carousel.png
```
È il carousel del Fitbit Air già generato — mostra esattamente badge, gerarchia testi, posizione immagine, palette e footer. Replicare quella struttura visiva, non inventarne una nuova.

**Prompt da dare a Claude Code:**

```
Crea frontend/carousel.html come pagina di export per Instagram.
NON toccare index.html, NON toccare review.html.

OBIETTIVO:
Ogni articolo viene mostrato come 5 card 1080x1350px reali, una accanto all'altra in riga
orizzontale scrollabile. L'utente fa screenshot di ogni card per postarla su Instagram.

DIMENSIONI FISSE — non responsive, non scalate:
Ogni card: width: 1080px, height: 1350px
Contenitore riga articolo: display flex, overflow-x: auto, gap: 40px, align-items: flex-start

STRUTTURA BASE DI OGNI CARD (position: relative, overflow: hidden, flex-shrink: 0):
Sfondo: #0A0F1E, box-sizing: border-box
Font: Inter da Google Fonts, fallback system-ui

ELEMENTI FISSI SU OGNI CARD (indipendenti dal layout_type):

1. Badge "AI NEWS" — position: absolute, top: 48px, left: 52px
   background: #3B82F6, colore: white, font-size: 18px, font-weight: 700,
   border-radius: 24px, padding: 6px 20px

2. Hook — position: absolute, top: 120px, left: 52px, max-width: 580px
   font-size: 72px, font-weight: 700, colore: #F8FAFC, line-height: 1.15
   Il secondo termine significativo: <span style="color:#3B82F6">termine</span>

3. Description + icona — position: absolute, bottom: 160px, left: 52px, max-width: 520px
   font-size: 28px, colore: #94A3B8, line-height: 1.4, max 3 righe
   Sopra la description: icona SVG (vedi set icone sotto), width: 48px, colore: #3B82F6

4. Footer — position: absolute, bottom: 48px, left: 52px, right: 52px
   display: flex, justify-content: space-between
   sinistra: "N/5" font-size: 24px colore: #334155
   destra: "@aisnap" font-size: 24px colore: #334155

LAYOUT ENGINE — ogni card applica un layout_type diverso al visual (article.image):
Il visual è sempre position: absolute, usa article.image come src con object-fit: cover.
Se article.image è assente o dà errore → sostituisci con div placeholder:
  background: radial-gradient(circle at 60% 40%, #1E3A5F 0%, #0A0F1E 70%)
  stesso box del visual, testo centrato: slide.visual_hint, font-size: 20px, colore: #3B82F6 opacity 0.5

Layout per layout_type:

"hero"
  visual: right: 0, top: 0, width: 440px, height: 100%
  object-position: center center
  overlay: linear-gradient(to right, #0A0F1E 30%, transparent 70%) sopra il visual

"right-focus"
  visual: right: 0, top: 200px, width: 400px, height: 600px
  object-position: center center
  overlay: nessuno
  bordo sinistro visual: 2px solid rgba(59,130,246,0.3)

"sensor-zoom"
  visual: right: -40px, top: 180px, width: 480px, height: 480px
  object-position: center center, transform: scale(1.4)
  overlay: linear-gradient(to bottom, transparent 60%, #0A0F1E 100%) sopra il visual
  effetto: box-shadow inset su 3 lati con #0A0F1E per sfumare i bordi

"human-hand"
  visual: right: 0, bottom: 80px, width: 420px, height: 500px
  object-position: bottom center
  overlay: linear-gradient(to top, transparent 50%, #0A0F1E 100%) sopra il visual

"cta-final"
  visual: right: 20px, top: 140px, width: 400px, height: 560px
  object-position: center center
  overlay: nessuno
  glow: box-shadow: 0 0 80px rgba(59,130,246,0.4) sul contenitore visual
  bordo: 1px solid rgba(59,130,246,0.4)

ICON SET (SVG inline, width/height 48px, fill: #3B82F6):
"tag"       → rettangolo con orecchio angolato (icona etichetta/prezzo)
"waves"     → 3 archi concentrici (onde tattili)
"heart"     → forma cuore
"vibration" → linea verticale con onde simmetriche ai lati
"check"     → segno di spunta

FONT nel <head>:
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">

DATI:
<script src="data.js"></script>
Mostra solo articoli con carousel_slides non vuoto.
Se carousel_slides è assente → salta senza errori.
article.image può essere undefined → fallback silenzioso al placeholder.

UI DI SERVIZIO (fuori dalle card, non negli screenshot):
- "N articoli con carousel" in cima, testo piccolo grigio
- Link "← Feed" → index.html
- Testo piccolo: "Screenshot ogni card — zoom browser 100%"
- margin-bottom: 80px tra articoli diversi

NESSUNA interazione — pagina statica di export.
```

**Test manuale dopo Step C:**
1. Apri `frontend/carousel.html` in locale
2. Scegli un articolo con `image` e guarda le 5 card in sequenza:
   - Slide 1 (hero): foto a destra full-height con overlay gradiente
   - Slide 2 (right-focus): foto più piccola con bordo blu
   - Slide 3 (sensor-zoom): foto ingrandita 1.4x sfumata in basso
   - Slide 4 (human-hand): foto ancorata in basso
   - Slide 5 (cta-final): foto con glow blu
3. Verifica che le icone sopra la description siano diverse per ogni slide
4. Verifica che gli articoli senza `image` mostrino il placeholder scuro con `visual_hint`
5. Apri `index.html` e `review.html` — invariati
6. Zoom browser 100%, screenshot di una card → 1080×1350px in un editor

> **Nota sullo screenshot manuale:** accettato per M21/M22. Export affidabile → `export-carousel.js` con Playwright in FASE 6.

---

### Step D — Deploy ✅ (2026-05-08)

Push effettuato su `main` → Railway autodeploy completato.

File deployati: `generate.js`, `backfill-carousel.js`, `frontend/carousel.html`, `frontend/index.html`, `frontend/data.js`, `output/` (2 articoli test con carousel_slides + immagini).

---

### Step E — Full backfill (58 articoli) ✅ (2026-05-08)

```bash
node backfill-carousel.js
```

**Risultato:** carousel_slides Aggiornati: 55 | Già presenti: 3 | Falliti: 0 — article.image Trovate: 31 — wikimedia s2-5 Trovate: 127 | Non trovate: 95 (→ card carousel come fallback in index.html)

**Bug risolto:** `buildDataJs` non ordinava i file prima della deduplicazione per slug — prendeva file casuali invece del più recente, lasciando 37 articoli senza `carousel_slides` in `data.js`. Fix: `.sort().reverse()` su `readdirSync` prima del map. Risultato finale: 58/58 articoli con carousel_slides.

---

### Pexels API — upgrade immagini carousel ✅ (2026-05-11)

Wikimedia sostituita con Pexels su tutte le slide 2-5. Implementato anticipatamente rispetto alla FASE 5 perché M21 richiede già immagini di qualità per i post Instagram.

**Cosa è stato fatto:**
- `fetchPexelsImage(query)` e `fetchArticleImage(url)` aggiunte a `fetch.js` (condivise)
- `backfill-carousel.js`: Pexels al posto di Wikimedia, flag `--force` per sovrascrittura, flag `--last N` per backfill selettivo
- `run.js`: fetch Pexels (slide 2-5) + og:image (slide 1) automatici su ogni nuovo articolo
- `carousel.html`: download PNG 1080×1350 esatti per Instagram (html2canvas, no border-radius, bottoni per slide + scarica tutte + modal tasto destro/long press)
- Backfill eseguito sulle ultime 20 notizie: 76/76 Pexels trovate ✅

**Parametri:**
- Orientamento: `portrait` (adatto alle card 4:5)
- Qualità: `large2x` (~1880px)
- Rate limit backfill: 18s tra chiamate (200 req/ora free tier)
- Per future migrazioni: `node backfill-carousel.js --force --last N`

---

## FASE 3 — Identificazione pattern (dopo 15 thread)

Con i 15 thread completi, si compila l'analisi in `test-distribuzione.md`.

### Cosa estrarre
- Hook che fermano: esempi concreti e tipo (domanda / numero / contrasto / conseguenza)
- Hook deboli: troppo descrittivi, troppo tecnici, troppo neutri
- Slide origine più frequente per tweet 1: la 1 vince sempre o la 3/5 la supera spesso?
- Topic migliori: coding AI, agenti, produttività, sostituzione del lavoro, costi AI
- Topic deboli: bassa interazione o nessun bookmark

### Output
Sezione "Pattern vincenti" e "Pattern da evitare" in `test-distribuzione.md` — input diretto per M22.

---

## FASE 4 — M22 (iterazione prompt da dati reali)

**Solo dopo M21 completato e analisi pattern pronta.**

Obiettivo: aggiornare i prompt con i dati reali.

### Cosa fare
- Arricchire il prompt M14 con una tassonomia di hook basata sui risultati reali
- Forzare/evitare certi tipi di hook in base al topic
- Se la slide 3 o 5 risulta sistematicamente migliore come apertura X, aggiungere `selectBestHookForX(slides)` automatico
- Aggiornare anche `generateCarouselSlides()` con gli stessi dati

---

## FASE 5 — Secondo canale (Instagram o TikTok)

**Solo dopo M22 completato.**

`carousel.html` è già pronto con foto reali degli articoli a 1080×1350px. Il lavoro rimanente:
- **Instagram**: screenshot delle card da `carousel.html` (una per slide) + caption da `thread_text`; Reel da `video_script`
- **TikTok**: video con TTS, testo in overlay, ritmo rapido da `video_script`

> Screenshot manuale accettato per M21/M22. Export affidabile in produzione → `export-carousel.js` con Playwright in FASE 6.

---

## FASE 6 — Automazione

**Solo quando soddisfatte tutte queste condizioni:**
- 2–3 pattern di hook vincenti e stabili
- Un canale che converte meglio
- Un formato definitivo
- Layer di selezione automatica dell'hook per canale (da M22)

**Cosa aggiungere in questa fase:**
- `export-carousel.js` con Playwright — salva `exports/{slug}/slide-1.png … slide-5.png` a risoluzione esatta senza dipendere dallo zoom del browser
- Automazione pubblicazione (solo se il flusso manuale è già stabile e ripetibile)

---

## Riepilogo cronologico

```
PRE-M21 ✅
  └── fix generateSlides() + generateFormats()
  └── 45/45 articoli rigenerati

M21 ← inizia subito, nessun blocco tecnico
  └── crea test-distribuzione.md
  └── crea account X + bio
  └── seleziona 15 thread da review.html → compila coda
  └── 15 thread, 1 al giorno, orario fisso
  └── log giornaliero: impression, bookmark, reply, repost
  └── stop anticipato se 0 segnali su 5 post consecutivi

M21b ← parte dopo i primi 5 thread di M21
  └── Step A: generateCarouselSlides() in generate.js ✅
        + thread_text come input per description più ricche
        + icon scelto dall'AI (non fisso), layout_type fisso in ordine
        + image_query per slide (2-3 keyword EN per ricerca Wikimedia)
  └── Step A.5: fetchArticleImage() in backfill-carousel.js ✅
        (non in fetch.js come da spec — da valutare integrazione in run.js in M22)
  └── Step B: backfill-carousel.js creato ✅ — testato su 2 articoli ✅
        + fetchWikimediaImage() per slide 2-5 (con User-Agent, filtri PDF/ritratti, match 2 parole)
        full backfill (57 articoli) ⏳ — pronto, da lanciare
  └── Step C: frontend/carousel.html ✅ — 270×337px dark tech
        + slide 1: article.image (og:image) come sfondo
        + slide 2-5: Wikimedia Commons via image_query
        + index.html: article.image come sfondo .slide-visual
  └── Step D: git push → deploy Railway ✅
  └── Step E: full backfill 58 articoli ✅ — 58/58 con carousel_slides

FASE 3 ← dopo 15 thread completati
  └── analisi pattern → test-distribuzione.md

M22 ← dopo analisi pattern
  └── update prompt con dati reali

FASE 5 ← dopo M22
  └── Instagram + TikTok (carousel.html pronto con foto reali articoli)

FASE 6 ← automazione
  └── export-carousel.js con Playwright (PNG esatti senza dipendere dallo zoom browser)
  └── automazione pubblicazione (solo se flusso manuale già stabile)
```

---

## Prossimi passi immediati

1. Dare il prompt "Preparazione account" a Claude Code → crea `test-distribuzione.md`
2. Creare account X → compilare bio e foto profilo
3. Aprire `review.html` → selezionare i 15 thread più forti → compilare la coda
4. Scegliere l'orario fisso di pubblicazione e annotarlo
5. **Iniziare a pubblicare il giorno stesso** — M21b non è un prerequisito
6. Dopo i primi 5 thread → dare Step A di M21b a Claude Code