# FASE 16 — Template Catalog

**Documento di pianificazione per Claude Code**
Contesto: `PROJECT.md` + `MANUAL.md` + `FASE15-video-template-engine.md`
Stato precedente: FASE 15 ✅ completa — architettura modulare + kinetic_typography operativi

---

## Premessa

FASE 15 ha costruito l'engine. FASE 16 aggiunge i template, uno alla volta, usando l'interfaccia comune già definita:

```js
module.exports = {
  id: 'nome_template',
  label: 'Label UI',
  requiresCarouselPng: false,
  generatePlanPrompt: `...`,   // null = usa prompt standard
  async render(article, scenes, agentConfig, outputPath) { ... },
};
```

Ogni template viene:
1. Aggiunto a `video/templates/index.js`
2. Aggiunto a `agents/*/config.js` → `videoTemplates[]`
3. Aggiunto a `carousel.html` → `templateLabels{}`

Nessun altro file si tocca per aggiungere un template.

---

## Stack per categoria

### Categoria 1 — Facili (SVG + FFmpeg)
Dipendenza: solo FFmpeg (già installato)
Nessuna libreria npm aggiuntiva.

Tecnica comune:
- Node.js genera stringhe SVG per ogni frame
- FFmpeg `lavfi color` + `drawtext` / `overlay` per animazioni semplici
- Oppure: frame SVG salvati come file temporanei + FFmpeg slideshow
- OpenAI TTS per voiceover (già in slide-deck.js — riusare)

Template in questa categoria: `data_story`, `timeline_motion`, `network_graph`,
`minimal_documentary`, `code_terminal`, `whiteboard`

### Categoria 2 — Medi (SVG complesso + FFmpeg)
Dipendenza: ImageMagick CLI (`sudo apt-get install imagemagick`)
Usato per: SVG → PNG frame quando FFmpeg non supporta SVG direttamente con font custom.

Template in questa categoria: `isometric_workflow`, `map_explainer`,
`parallax_25d`, `simulation_lab`, `wireframe_3d`

### Categoria 3 — Difficili (Blender CLI + FFmpeg)
Dipendenza: Blender (`sudo apt-get install blender` oppure da blender.org, ~500MB)
Asset `.blend` costruiti una volta, riusati forever.
Python script chiamati via `child_process.execSync`.

Template in questa categoria: `anatomy_motion`, `product_xray`, `lowpoly_3d`

---

## Ordine di implementazione

```
FASE 16A  →  data_story           (Categoria 1 — facile, alto impatto per ai-news)
FASE 16B  →  timeline_motion      (Categoria 1 — facile, generico)
FASE 16C  →  network_graph        (Categoria 1 — facile, perfetto per ai-news)
FASE 16D  →  minimal_documentary  (Categoria 1 — usa Pexels già disponibili)
FASE 16E  →  code_terminal        (Categoria 1 — nicchia dev, molto caratteristico)
FASE 16F  →  whiteboard           (Categoria 1 — SVG stroke-dashoffset)
FASE 16G  →  isometric_workflow   (Categoria 2 — ottimo per spiegare sistemi/pipeline)
FASE 16H  →  map_explainer        (Categoria 2 — per news geopolitiche)
FASE 16I  →  parallax_25d         (Categoria 2 — evoluzione naturale di slide_deck)
FASE 16J  →  simulation_lab       (Categoria 2 — differenziante per ai-news)
FASE 16K  →  wireframe_3d         (Categoria 2 — fake 3D in SVG)
FASE 16L  →  anatomy_motion       (Categoria 3 — Blender, killer feature per fitness)
FASE 16M  →  product_xray         (Categoria 3 — Blender, per gadget/AI hardware)
FASE 16N  →  lowpoly_3d           (Categoria 3 — Blender, storytelling generico)
```

Ogni FASE 16x è indipendente. Si possono fare in ordine diverso senza conseguenze.

---

## Aggiornamenti config agenti — riepilogo finale

Dopo tutte le FASE 16, i config agenti avranno:

```js
// agents/ai-news/config.js
videoTemplates: [
  'slide_deck', 'kinetic_typography', 'data_story', 'timeline_motion',
  'network_graph', 'minimal_documentary', 'code_terminal', 'whiteboard',
  'isometric_workflow', 'map_explainer', 'simulation_lab', 'wireframe_3d',
  'product_xray'
],
defaultVideoTemplate: 'kinetic_typography',

// agents/food/config.js
videoTemplates: [
  'slide_deck', 'kinetic_typography', 'minimal_documentary',
  'timeline_motion', 'whiteboard'
],
defaultVideoTemplate: 'kinetic_typography',

// agents/fitness/config.js
videoTemplates: [
  'slide_deck', 'kinetic_typography', 'whiteboard',
  'minimal_documentary', 'simulation_lab', 'anatomy_motion'
],
defaultVideoTemplate: 'anatomy_motion',  // quando implementato
```

I config vanno aggiornati **template per template** man mano che vengono implementati — non tutti in anticipo.

---

## FASE 16A — data_story

**Descrizione:** grafici animati — barre che crescono, numeri che aumentano, linee di trend. Perfetto per articoli con statistiche, mercati, confronti, crescita.

**Agente target:** ai-news (primario), tutti (secondario)

**Stack:** SVG + FFmpeg drawtext + FFmpeg lavfi

**generatePlanPrompt:**
```
Articolo: {{title}}
Testo: {{video_script}}

Genera 5 scene per un video data-story in verticale 9:16.
Per ogni scena restituisci JSON con:
  - voiceover: (stringa, max 22 parole, narrazione TTS)
  - on_screen_text: (stringa, max 8 parole, titolo della scena)
  - duration_sec: (intero 4-8)
  - chart_type: ("bar" | "line" | "number_counter" | "pie" | "comparison")
  - data_points: (array di oggetti { label: string, value: number, color?: string } — max 5)
  - highlight: (stringa — il dato più importante da enfatizzare)
  - trend: ("up" | "down" | "neutral")

Se l'articolo non contiene dati numerici espliciti, usa dati simbolici coerenti col contenuto.
```

**Tecnica rendering:**

```
Per ogni scena:
  1. Legge chart_type e data_points dalle scenes[]
  2. Genera SVG del grafico (frame iniziale — valori a 0)
  3. Genera N frames intermedi con valori che crescono linearmente fino al target
     (25fps × duration_sec frames)
  4. Salva ogni frame come PNG temporaneo con ImageMagick convert
  5. TTS da voiceover
  6. FFmpeg: slideshow PNG frames + audio → clip scena

chart_type = "number_counter":
  Testo enorme al centro (es. "47%") che conta da 0 al valore target
  Generato con FFmpeg drawtext + expr per contatore

chart_type = "bar":
  Barre verticali SVG con altezza variabile frame per frame
  Colore accent agentConfig.videoPalette.accent per il valore highlight
  Label sotto ogni barra

chart_type = "line":
  Polyline SVG con punti che appaiono in sequenza
  Sfondo grigio scuro, linea colore accent

chart_type = "comparison":
  Due colonne affiancate (prima/dopo, A vs B)
  Label + valore sotto ogni colonna

Sfondo sempre agentConfig.videoPalette.bg
Testo agentConfig.videoPalette.text
```

**File da creare:** `video/templates/data-story.js`

**Prompt Claude Code:**
```
Progetto: /home/miki/visual-scroll-blog
Task: creare video/templates/data-story.js

Prima leggere:
- video/templates/kinetic-typography.js (pattern TTS + FFmpeg + cleanup)
- video/templates/slide-deck.js (pattern TTS OpenAI)
- FASE16-template-catalog.md sezione "FASE 16A — data_story"

Interfaccia da rispettare (obbligatoria):
  id: 'data_story'
  label: 'Data Story'
  requiresCarouselPng: false
  generatePlanPrompt: (stringa dal documento FASE16)
  async render(article, scenes, agentConfig, outputPath): ...

Logica render per chart_type "number_counter":
  Usa FFmpeg drawtext con alpha fade in (stessa tecnica di kinetic-typography.js)
  Testo: valore iniziale → valore finale animato tramite frame SVG generati in loop Node.js
  Font size 180px, centrato

Logica render per chart_type "bar":
  Genera frames SVG in loop Node.js (una per frame)
  Ogni frame ha le barre con height = value * (frame/totalFrames)
  Salva ogni SVG come PNG con: execSync('convert -size 1080x1920 svg:input.svg output.png')
  FFmpeg assembla i PNG in video a 25fps

Logica render per gli altri chart_type: usare la stessa tecnica SVG frame-by-frame

Aggiungere a video/templates/index.js:
  'data_story': require('./data-story'),

Aggiungere a agents/ai-news/config.js → videoTemplates[]:
  'data_story'

Aggiungere a frontend/carousel.html → templateLabels{}:
  data_story: 'Data Story'

NON usare librerie npm.
NON modificare slide-deck.js o kinetic-typography.js.
Se ImageMagick non è disponibile, fallback a FFmpeg -f lavfi per sfondo + drawtext per testo.
```

**Test:**
```bash
node video/render-video-v2.js --agent ai-news --slug <slug-articolo-con-statistiche>
ls -lh output/renders/<slug>.mp4 && echo "✅ data_story ok"
```

---

## FASE 16B — timeline_motion

**Descrizione:** linea del tempo verticale con eventi che appaiono dall'alto verso il basso. Date, label, icone semplici. Perfetto per "storia di X", "evoluzione di Y", "da GPT-1 a oggi".

**Agente target:** ai-news (primario), tutti

**Stack:** SVG + FFmpeg

**generatePlanPrompt:**
```
Articolo: {{title}}
Testo: {{video_script}}

Genera 5 scene per un video timeline in verticale 9:16.
Per ogni scena restituisci JSON con:
  - voiceover: (stringa, max 22 parole)
  - duration_sec: (intero 4-7)
  - events: (array di 1-3 oggetti { date: string, label: string, type: "milestone"|"problem"|"solution"|"now" })
  - camera_motion: ("pan_down" | "zoom_in" | "static")
  - scene_title: (stringa, max 6 parole, titolo della scena)
```

**Tecnica rendering:**

```
Layout fisso per ogni scena:
  - Linea verticale al centro orizzontale (x=540)
  - Cerchi colorati sui nodi evento
  - Label a destra dei nodi
  - Data a sinistra

Animazione: gli eventi appaiono dall'alto verso il basso
  frame 0:   solo la linea verticale
  frame 10:  primo evento appare (fade in)
  frame 20:  secondo evento appare
  frame 30+: camera pan verso il basso (translateY via SVG transform)

type = "milestone" → cerchio blu accent
type = "problem"   → cerchio rosso #ef4444
type = "solution"  → cerchio verde #22c55e
type = "now"       → cerchio accent lampeggiante (pulse via opacity alternata)

camera_motion = "pan_down": SVG viewBox.y aumenta frame per frame
camera_motion = "zoom_in": SVG viewBox.width diminuisce frame per frame
```

**File da creare:** `video/templates/timeline-motion.js`

**Prompt Claude Code:**
```
Progetto: /home/miki/visual-scroll-blog
Task: creare video/templates/timeline-motion.js

Prima leggere:
- video/templates/kinetic-typography.js
- FASE16-template-catalog.md sezione "FASE 16B — timeline_motion"

Interfaccia obbligatoria:
  id: 'timeline_motion', label: 'Timeline', requiresCarouselPng: false

Generazione SVG:
  Usa Node.js template literal per generare stringhe SVG.
  Dimensioni: viewBox="0 0 1080 1920"
  Linea verticale: <line x1="540" y1="80" x2="540" y2="1840" stroke="#334155" stroke-width="4"/>
  Nodo evento: <circle cx="540" cy={y} r="18" fill={coloreType}/>
  Label: <text x="580" y={y+6} fill={textColor} font-size="38">{label}</text>
  Data: <text x="460" y={y+6} fill={accentColor} font-size="30" text-anchor="end">{date}</text>

Animazione: genera frames SVG in loop dove ogni frame rivela più eventi.
Salva ogni SVG temporaneo, converti con FFmpeg o ImageMagick, poi concat.

Aggiungere a video/templates/index.js, agents/ai-news/config.js, carousel.html templateLabels.

NON usare librerie npm.
```

---

## FASE 16C — network_graph

**Descrizione:** nodi connessi che si formano progressivamente. Ogni nodo ha un'etichetta. I collegamenti appaiono uno alla volta. Perfetto per spiegare sistemi multi-agente, pipeline, relazioni tra concetti.

**Agente target:** ai-news

**Stack:** SVG + FFmpeg

**generatePlanPrompt:**
```
Articolo: {{title}}
Testo: {{video_script}}

Genera 5 scene per un video network-graph in verticale 9:16.
Per ogni scena restituisci JSON con:
  - voiceover: (stringa, max 22 parole)
  - duration_sec: (intero 5-8)
  - nodes: (array di oggetti { id: string, label: string, type: "input"|"process"|"output"|"agent"|"tool", x: number 0-1080, y: number 200-1700 })
  - edges: (array di oggetti { from: string, to: string, label?: string })
  - reveal_order: (array di id nodi nell'ordine in cui appaiono)
  - scene_title: (stringa, max 6 parole)

Usa 3-6 nodi per scena. Le coordinate x/y devono essere distribuite nello spazio verticale 9:16.
```

**Tecnica rendering:**

```
Tipi nodo → forma SVG:
  "input"   → cerchio, colore accent
  "process" → rettangolo arrotondato, colore testo su sfondo grigio scuro
  "output"  → cerchio, colore verde
  "agent"   → esagono (polygon), colore accent
  "tool"    → quadrato, colore grigio chiaro

Animazione:
  1. Tutti i nodi iniziano invisibili (opacity: 0)
  2. reveal_order[0] appare (fade in, 0.3s)
  3. Dopo 0.5s, appare il primo edge verso un nodo rivelato
  4. Poi reveal_order[1], e così via
  5. Quando tutti i nodi sono visibili, gli edge "pulsano" (opacity 0.5→1→0.5)

Edge: linea SVG con freccia (marker-end arrowhead)
Label edge: testo piccolo a metà del path

Genera frames SVG nel loop Node.js variando opacity di nodi/edge frame per frame.
```

**File da creare:** `video/templates/network-graph.js`

**Prompt Claude Code:**
```
Progetto: /home/miki/visual-scroll-blog
Task: creare video/templates/network-graph.js

Prima leggere:
- video/templates/kinetic-typography.js
- FASE16-template-catalog.md sezione "FASE 16C — network_graph"

Dettagli SVG obbligatori:
  - Definire arrowhead con <defs><marker id="arrow">...</marker></defs>
  - Edge: <line> o <path> con marker-end="url(#arrow)"
  - Nodo agent (esagono): <polygon points="..."> calcolato da centro x,y e raggio 50
  - Nodo process (rect): <rect rx="12" ry="12">
  - Label nodo: <text> centrato sul nodo, font-size 32, fill textColor

Animazione opacity: genera frames dove ogni nodo/edge ha opacity calcolata come:
  opacity = clamp((currentFrame - revealFrame) / fadeFrames, 0, 1)
  dove revealFrame = indice nel reveal_order × (totalFrames / nNodes)

Salva frames PNG con ImageMagick o FFmpeg, concat finale.

Aggiungere a index.js, agents/ai-news/config.js, carousel.html.
NON usare librerie npm (no d3, no graphlib).
```

---

## FASE 16D — minimal_documentary

**Descrizione:** immagine Pexels a schermo intero con overlay testo, Ken Burns (zoom lento), vignette scura. Stile documentario minimalista. Riusa le immagini già disponibili in ogni articolo.

**Agente target:** tutti

**Stack:** FFmpeg puro (zero SVG, zero ImageMagick)

**requiresCarouselPng:** false — usa `article.carousel_slides[i].image` (URL Pexels già nel JSON)

**generatePlanPrompt:**
```
Articolo: {{title}}
Testo: {{video_script}}

Genera 5 scene per un video documentary in verticale 9:16.
Per ogni scena restituisci JSON con:
  - voiceover: (stringa, max 22 parole)
  - headline: (stringa, max 7 parole, testo overlay grande)
  - subtext: (stringa, max 12 parole, testo secondario più piccolo)
  - duration_sec: (intero 5-9)
  - text_position: ("top" | "center" | "bottom")
  - ken_burns: ("zoom_in" | "zoom_out" | "pan_left" | "pan_right")
  - slide_index: (intero 0-4 — quale slide del carousel usare come immagine)
```

**Tecnica rendering:**

```
Per ogni scena:
  1. Scarica immagine da article.carousel_slides[slide_index].image
     (o usa PNG già in output/{agentId}/slides-png/{slug}/ se disponibili)
  2. FFmpeg resize a 1080×1920 (crop centrato)
  3. Applica Ken Burns con zoompan filter (già usato in slide-deck.js — riusare)
  4. Overlay vignette scura (colorchannelmixer / vignette FFmpeg filter)
  5. Overlay testo con FFmpeg drawtext:
     - headline: font-size 72, bianco, posizione text_position
     - subtext: font-size 38, bianco 70% opacity, sotto headline
  6. TTS da voiceover
  7. Merge video + audio

Questo template è il più semplice della categoria 2 perché riusa
esattamente la pipeline di slide-deck.js senza i PNG del carousel.
```

**File da creare:** `video/templates/minimal-documentary.js`

**Prompt Claude Code:**
```
Progetto: /home/miki/visual-scroll-blog
Task: creare video/templates/minimal-documentary.js

Prima leggere:
- video/templates/slide-deck.js (zoompan filter, TTS, pattern concat — riusare tutto)
- FASE16-template-catalog.md sezione "FASE 16D — minimal_documentary"

Differenze da slide-deck:
  - Non usa PNG dal filesystem — scarica immagine da URL in article.carousel_slides[i].image
  - Usa axios per scaricare l'immagine in un file temporaneo
  - Poi pipeline identica a slide-deck: zoompan + drawtext + TTS + concat

Per scaricare immagine:
  const axios = require('axios');  // già in package.json
  const response = await axios({ url, responseType: 'arraybuffer' });
  fs.writeFileSync(tempPath, response.data);

Fallback se carousel_slides non disponibile: usa sfondo solid color come kinetic-typography.

Aggiungere a index.js, tutti e tre i config agenti, carousel.html.
```

---

## FASE 16E — code_terminal

**Descrizione:** terminale nero con codice o log che appare carattere per carattere. Syntax highlight semplice (keyword colorate). Perfetto per contenuti developer, build in public, automazioni, pipeline.

**Agente target:** ai-news

**Stack:** SVG + FFmpeg

**generatePlanPrompt:**
```
Articolo: {{title}}
Testo: {{video_script}}

Genera 5 scene per un video terminal-style in verticale 9:16.
Per ogni scena restituisci JSON con:
  - voiceover: (stringa, max 22 parole)
  - duration_sec: (intero 5-9)
  - terminal_lines: (array di stringhe — max 8 righe — che appaiono nel terminale)
  - prompt_prefix: (stringa — es. "$ " o "node> " o "→ ")
  - highlight_line: (intero — indice della riga da evidenziare con colore accent)
  - scene_title: (stringa, max 6 parole)

Le righe devono essere codice realistico, comandi bash, output di log,
o pseudo-codice coerente con il contenuto dell'articolo.
```

**Tecnica rendering:**

```
Sfondo: #0d1117 (GitHub dark)
Font: monospace — FFmpeg drawtext usa font=monospace
Testo: #c9d1d9 (GitHub text)
Keyword color: accent agentConfig

Animazione typing:
  Per ogni riga, genera frames dove il testo appare carattere per carattere.
  Ogni carattere appare ogni 2-3 frame (velocità typing simulata).
  Cursore lampeggiante (█) all'ultimo carattere visibile.

Sintassi semplificata (FFmpeg drawtext multipli):
  - Parole che iniziano con $ o node> → colore prompt (#7ee787 verde)
  - Parole come require, const, async, function → colore keyword (#ff7b72 rosso)
  - Stringhe tra virgolette → colore stringa (#a5d6ff azzurro)
  - Riga highlight_line → sfondo leggermente più chiaro

Header terminale (sempre):
  Tre cerchi colorati in alto a sinistra (rosso/giallo/verde — macOS style)
  Nome file o comando in alto al centro

Genera frames SVG o usa FFmpeg drawtext per ogni frame.
```

**File da creare:** `video/templates/code-terminal.js`

**Prompt Claude Code:**
```
Progetto: /home/miki/visual-scroll-blog
Task: creare video/templates/code-terminal.js

Prima leggere:
- video/templates/kinetic-typography.js
- FASE16-template-catalog.md sezione "FASE 16E — code_terminal"

Implementazione:
  Genera frame SVG per ogni frame del video.
  Ogni SVG contiene solo le righe "già digitate" (progressivo).
  
  Struttura SVG:
    Sfondo: <rect fill="#0d1117" width="1080" height="1920"/>
    Cerchi header: <circle cx="60" cy="60" r="20" fill="#ff5f57"/>
                   <circle cx="110" cy="60" r="20" fill="#febc2e"/>
                   <circle cx="160" cy="60" r="20" fill="#28c840"/>
    Separatore: <line x1="0" y1="100" x2="1080" y2="100" stroke="#30363d"/>
    Righe testo: <text x="40" y={120 + lineIndex * 60} font-family="monospace" font-size="38">
                   {riga con parti colorate come tspan separati}
                 </text>

  Colorazione testo: split semplice per token, applica color rule con tspan.
  
  Cursore: ultimo carattere della riga corrente + rect bianco lampeggiante
    (alterna opacity 1/0 ogni 15 frame)

Genera 25fps × duration_sec frames. Salva PNG temporanei. Concat con FFmpeg.

Aggiungere a index.js, agents/ai-news/config.js, carousel.html.
NON usare librerie di syntax highlighting — solo logica custom semplice.
```

---

## FASE 16F — whiteboard

**Descrizione:** sfondo bianco, asset SVG lineari che appaiono progressivamente con animazione stroke-dashoffset (come disegnati a mano). Mano PNG opzionale. Testo typewriter. Il template "classico" whiteboard explainer.

**Agente target:** tutti

**Stack:** SVG stroke animation + FFmpeg

**generatePlanPrompt:**
```
Articolo: {{title}}
Testo: {{video_script}}

Genera 5 scene per un video whiteboard in verticale 9:16.
Per ogni scena restituisci JSON con:
  - voiceover: (stringa, max 22 parole)
  - duration_sec: (intero 6-9)
  - headline: (stringa, max 7 parole — testo scritto progressivamente)
  - elements: (array di 1-4 elementi, ognuno con:
      type: "icon" | "arrow" | "circle" | "rect" | "text"
      label?: stringa, max 4 parole
      position: { x: number 0-100, y: number 0-100 }  ← percentuali
      size: "small" | "medium" | "large"
      reveal_order: intero 0-3
    )
  - layout: ("centered" | "flow_left_right" | "top_down" | "comparison")
```

**Tecnica rendering:**

```
Sfondo: bianco #ffffff
Tratti: nero #1a1a1a, stroke-width 6-8px, stroke-linecap round

Asset SVG lineari (solo path/line/circle con fill:none, solo stroke):
  "arrow"  → path M x1,y1 L x2,y2 + arrowhead
  "circle" → circle senza fill, solo stroke
  "rect"   → rect senza fill, solo stroke, rx=8
  "icon"   → path semplice (persona = cerchio+rettangolo, lampada = path base, ecc.)

Animazione stroke-dashoffset:
  Per ogni shape SVG:
    totalLength = lunghezza path (approssimata per forme semplici)
    frame 0:   stroke-dasharray="{totalLength}" stroke-dashoffset="{totalLength}" (invisibile)
    frame n:   stroke-dashoffset="{totalLength * (1 - progress)}"
    frame end: stroke-dashoffset="0" (completamente visibile)

Testo typewriter:
  Genera frames dove il testo appare carattere per carattere
  Font: sans-serif 52px, colore #1a1a1a

Asset library minima (path SVG pre-definiti nel codice):
  persona:  "M540,300 m0,-40 a40,40 0 1,0 0.001,0 M540,340 l0,120 M480,400 l120,0 M540,460 l-60,100 M540,460 l60,100"
  freccia:  generata dinamicamente da to/from coordinate
  lampada:  path circolare base
  check:    "M460,600 l60,80 l120,-140"
  x:        "M460,560 l120,120 M580,560 l-120,120"
  star:     polygon pre-calcolato

Per elementi senza asset pre-definito: usa "circle" o "rect" come fallback.
```

**File da creare:** `video/templates/whiteboard.js`

**Prompt Claude Code:**
```
Progetto: /home/miki/visual-scroll-blog
Task: creare video/templates/whiteboard.js

Prima leggere:
- video/templates/kinetic-typography.js
- FASE16-template-catalog.md sezione "FASE 16F — whiteboard"

Implementazione SVG stroke animation:
  const ASSETS = {
    arrow: (x1,y1,x2,y2) => `M${x1},${y1} L${x2},${y2}`,
    circle: (cx,cy,r) => `M${cx-r},${cy} a${r},${r} 0 1,0 ${r*2},0 a${r},${r} 0 1,0 -${r*2},0`,
    check: (x,y,size) => `M${x},${y+size*0.5} l${size*0.4},${size*0.5} l${size*0.8},-${size*0.9}`,
    persona: (cx,cy,size) => `M${cx},${cy-size*0.3} m0,${-size*0.25} a${size*0.25},${size*0.25} 0 1,0 0.001,0 M${cx},${cy-size*0.05} l0,${size*0.6}`,
  };

  Per ogni frame: calcola progress per ogni element.
  Genera <path d={...} stroke="#1a1a1a" stroke-width="7" fill="none"
               stroke-dasharray="{len}" stroke-dashoffset="{len*(1-progress)}"
               stroke-linecap="round"/>

  Salva frame SVG → PNG con ImageMagick o FFmpeg input pipe.
  25fps × duration_sec frame per scena.

Aggiungere a index.js, tutti e tre config agenti, carousel.html.
```

---

## FASE 16G — isometric_workflow

**Descrizione:** diagramma isometrico che mostra workflow, pipeline, sistemi. Blocchi 3D-illusion disegnati in SVG puro. Connettori con frecce. Perfetto per spiegare il funzionamento di un sistema SaaS/AI.

**Agente target:** ai-news

**Stack:** SVG isometrico + ImageMagick + FFmpeg

**generatePlanPrompt:**
```
Articolo: {{title}}
Testo: {{video_script}}

Genera 5 scene per un video isometric-workflow in verticale 9:16.
Per ogni scena restituisci JSON con:
  - voiceover: (stringa, max 22 parole)
  - duration_sec: (intero 6-9)
  - blocks: (array di 2-5 blocchi, ognuno con:
      id: stringa
      label: stringa, max 3 parole
      type: "input" | "process" | "output" | "database" | "user"
      iso_col: intero 0-4  ← colonna isometrica
      iso_row: intero 0-3  ← riga isometrica
    )
  - connections: (array di { from: id, to: id, label?: stringa, max 2 parole })
  - scene_title: (stringa, max 5 parole)
  - focus_block: (id del blocco da enfatizzare — accent color)
```

**Tecnica rendering:**

```
Proiezione isometrica classica (2:1 pixel ratio):
  iso_x = (col - row) * tile_w / 2
  iso_y = (col + row) * tile_h / 4
  Con tile_w=220, tile_h=110 e offset centrale (540, 400)

Blocco isometrico in SVG (tre facce visibili):
  top_face    = parallelogramma superiore (colore chiaro)
  left_face   = parallelogramma sinistro (colore medio)
  right_face  = parallelogramma destro (colore scuro)

Tipo → colori:
  "input"    → top #3b82f6 20% lighter, left #3b82f6, right #1d4ed8
  "process"  → top #6366f1 20% lighter, left #6366f1, right #4338ca
  "output"   → top #22c55e 20% lighter, left #22c55e, right #15803d
  "database" → top #f59e0b 20% lighter, left #f59e0b, right #b45309
  "user"     → top #ec4899 20% lighter, left #ec4899, right #9d174d

focus_block → tutte le facce 30% più luminose + glow SVG filter

Connessioni: <line> in proiezione isometrica con freccia
Label blocco: testo sopra il blocco, centrato, font 36px bianco

Animazione: i blocchi appaiono uno alla volta (reveal_order = connections order)
  Ogni blocco inizia con opacity:0, poi fade in in 0.5s
  Poi appare il connector verso il blocco successivo
```

**File da creare:** `video/templates/isometric-workflow.js`

**Prompt Claude Code:**
```
Progetto: /home/miki/visual-scroll-blog
Task: creare video/templates/isometric-workflow.js

Prima leggere:
- FASE16-template-catalog.md sezione "FASE 16G — isometric_workflow"

Funzione helper isometrica obbligatoria:
  function isoToScreen(col, row, tileW=220, tileH=110, offsetX=540, offsetY=500) {
    return {
      x: offsetX + (col - row) * tileW / 2,
      y: offsetY + (col + row) * tileH / 4
    };
  }

Funzione per generare un blocco isometrico:
  function isoBlock(col, row, colors, label) {
    const { x, y } = isoToScreen(col, row);
    const w = 110, h = 55;  // metà tile
    // top face: parallelogramma
    const topPoints = `${x},${y-h} ${x+w},${y-h/2} ${x},${y} ${x-w},${y-h/2}`;
    // left face
    const leftPoints = `${x-w},${y-h/2} ${x},${y} ${x},${y+h} ${x-w},${y+h/2}`;
    // right face
    const rightPoints = `${x},${y} ${x+w},${y-h/2} ${x+w},${y+h/2} ${x},${y+h}`;
    return `
      <polygon points="${topPoints}" fill="${colors.top}"/>
      <polygon points="${leftPoints}" fill="${colors.left}"/>
      <polygon points="${rightPoints}" fill="${colors.right}"/>
      <text x="${x}" y="${y-h-15}" text-anchor="middle" fill="white" font-size="36">${label}</text>
    `;
  }

Genera frame SVG per ogni passo dell'animazione. Usa ImageMagick per SVG→PNG.
Aggiungere a index.js, agents/ai-news/config.js, carousel.html.
NON usare librerie npm.
```

---

## FASE 16H — map_explainer

**Descrizione:** mappa SVG geografica con paesi/regioni che si illuminano, linee animate tra punti, zoom su aree. Per news con componente geografica (data center, supply chain, geopolitica tech).

**Agente target:** ai-news

**Stack:** GeoJSON + SVG + FFmpeg

**generatePlanPrompt:**
```
Articolo: {{title}}
Testo: {{video_script}}

Genera 5 scene per un video map-explainer in verticale 9:16.
Per ogni scena restituisci JSON con:
  - voiceover: (stringa, max 22 parole)
  - duration_sec: (intero 5-8)
  - countries: (array di { code: string ISO2, label: string, type: "highlight"|"origin"|"destination" })
  - routes: (array di { from: string ISO2, to: string ISO2, type: "data"|"product"|"money" })
  - zoom_region: ("world" | "europe" | "asia" | "north_america" | "east_asia")
  - scene_title: (stringa, max 5 parole)

Usa paesi/regioni reali relativi al contenuto dell'articolo.
```

**Tecnica rendering:**

```
Dati geografici: Natural Earth 110m (file GeoJSON lightweight, ~400KB, dominio pubblico)
  URL: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson
  Scarica una volta e salva in blender/assets/world-110m.geojson

Proiezione: Mercator semplificata
  Per ogni feature GeoJSON → path SVG con coordinate proiettate

Sfondo: #0f172a (dark)
Paese base: #1e293b (grigio scuro)
highlight: accent del config agente
origin: #22c55e (verde)
destination: #ef4444 (rosso)

Route animate:
  <path> con stroke-dashoffset da lunghezza totale a 0 (stesso meccanismo whiteboard)
  type="data"     → linea tratteggiata blu
  type="product"  → linea continua arancio
  type="money"    → linea tratteggiata verde

Zoom_region: cambia viewBox SVG per inquadrare l'area:
  world:         viewBox="0 0 1080 1920"
  europe:        viewBox="400 200 400 600"
  east_asia:     viewBox="700 200 380 500"
  north_america: viewBox="0 150 500 700"

Animazione: paesi si illuminano in sequenza, poi le route si disegnano
```

**File da creare:** `video/templates/map-explainer.js`
**File da scaricare (una volta):** `video/assets/world-110m.geojson`

**Prompt Claude Code:**
```
Progetto: /home/miki/visual-scroll-blog
Task: creare video/templates/map-explainer.js

Prima leggere:
- FASE16-template-catalog.md sezione "FASE 16H — map_explainer"

Step 1 — scarica GeoJSON se non esiste:
  const GEOJSON_PATH = path.join(__dirname, '../assets/world-110m.geojson');
  if (!fs.existsSync(GEOJSON_PATH)) {
    const axios = require('axios');
    const data = await axios.get('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson');
    fs.mkdirSync(path.dirname(GEOJSON_PATH), { recursive: true });
    fs.writeFileSync(GEOJSON_PATH, JSON.stringify(data.data));
  }

Step 2 — proiezione Mercatore semplice:
  function project(lon, lat, width=1080, height=1920) {
    const x = (lon + 180) / 360 * width;
    const latRad = lat * Math.PI / 180;
    const mercN = Math.log(Math.tan(Math.PI/4 + latRad/2));
    const y = height/2 - (mercN * height / (2 * Math.PI)) * (height/width);
    return [x, y];
  }

Step 3 — genera path SVG per ogni paese:
  Legge features dal GeoJSON, proietta le coordinate, genera <path d="..."/>.
  Colora in base a countries[] dalla scene.

Step 4 — genera frames per animazione illuminate + routes.

Crea cartella video/assets/ se non esiste.
Aggiungere a index.js, agents/ai-news/config.js, carousel.html.
NON usare d3 o altre librerie npm.
```

---

## FASE 16I — parallax_25d

**Descrizione:** immagini ritagliate in layer a velocità diverse, simulando profondità. Evoluzione naturale di slide_deck — stesso materiale (immagini Pexels), resa molto più cinematica.

**Agente target:** tutti

**Stack:** FFmpeg puro (overlay multipli)

**generatePlanPrompt:**
```
Articolo: {{title}}
Testo: {{video_script}}

Genera 5 scene per un video parallax in verticale 9:16.
Per ogni scena restituisci JSON con:
  - voiceover: (stringa, max 22 parole)
  - duration_sec: (intero 5-8)
  - headline: (stringa, max 7 parole)
  - slide_index: (intero 0-4 — quale slide carousel usare)
  - parallax_direction: ("up" | "down" | "left" | "right")
  - overlay_opacity: (numero 0.3-0.7 — quanto scurire l'immagine)
  - text_position: ("top" | "center" | "bottom")
```

**Tecnica rendering:**

```
Usa l'immagine Pexels dell'articolo (stesso approccio di minimal_documentary).

Parallax via FFmpeg:
  Layer 1 (sfondo): immagine scalata 120%, si muove nella direzione parallax_direction
    filtro: scale=1296:2304, crop=1080:1920:x=offset_x_t:y=offset_y_t
    dove offset cresce linearmente nel tempo (es. +30px per i secondi)
  Layer 2 (overlay scuro): colorchannelmixer o geq per vignette
  Layer 3 (testo): drawtext headline + subtext

FFmpeg filter_complex:
  [0:v]scale=1296:2304,crop=1080:1920:x='min(216,t*15)':y=0[bg];
  [bg]vignette[vign];
  [vign]drawtext=...[out]

Nessuna PNG separata — tutto in un singolo ffmpeg command per scena.
```

**File da creare:** `video/templates/parallax-25d.js`

**Prompt Claude Code:**
```
Progetto: /home/miki/visual-scroll-blog
Task: creare video/templates/parallax-25d.js

Prima leggere:
- video/templates/slide-deck.js (zoompan, TTS, pattern generale)
- video/templates/minimal-documentary.js (download immagine Pexels)
- FASE16-template-catalog.md sezione "FASE 16I — parallax_25d"

Differenza chiave da minimal-documentary:
  Usa FFmpeg crop con offset variabile nel tempo per simulare il parallax:
    parallax_direction = "up":    y='min(200,t*25)'
    parallax_direction = "down":  y='max(0,200-t*25)'
    parallax_direction = "left":  x='min(216,t*20)'
    parallax_direction = "right": x='max(0,216-t*20)'

  Prima scala l'immagine al 120% (1296×2304), poi crop 1080×1920 con offset dinamico.

Aggiungere a index.js, tutti e tre i config agenti, carousel.html.
```

---

## FASE 16J — simulation_lab

**Descrizione:** particelle/agenti che si muovono su schermo, interagiscono, formano cluster. Perfetto per spiegare sistemi complessi, diffusione informazioni, AI agents, algoritmi.

**Agente target:** ai-news, fitness

**Stack:** SVG frames pre-calcolati in Node.js + FFmpeg

**generatePlanPrompt:**
```
Articolo: {{title}}
Testo: {{video_script}}

Genera 5 scene per un video simulation in verticale 9:16.
Per ogni scena restituisci JSON con:
  - voiceover: (stringa, max 22 parole)
  - duration_sec: (intero 5-8)
  - simulation_type: ("particle_spread" | "network_form" | "agent_decision" | "data_flow" | "cluster_emerge")
  - num_particles: (intero 5-30)
  - particle_color_scheme: ("blue_red" | "green_white" | "rainbow" | "monochrome")
  - speed: ("slow" | "medium" | "fast")
  - scene_title: (stringa, max 5 parole)
  - annotation: (stringa, max 10 parole — testo esplicativo in overlay)
```

**Tecnica rendering:**

```
Simulazione fisica in Node.js pura (zero canvas, zero browser):
  Ogni particella ha: { x, y, vx, vy, color, radius, type }
  Per ogni frame:
    aggiorna posizione: p.x += p.vx, p.y += p.vy
    applica comportamento per simulation_type:
      "particle_spread": repulsione mutua + attrazione verso centro
      "network_form":    le particelle rallentano e formano connessioni se vicine
      "agent_decision":  gruppi di particelle convergono verso punti attrattori
      "data_flow":       particelle si muovono lungo path predefiniti (da sinistra a destra)
      "cluster_emerge":  attrazione verso N centri, formano cluster colorati

Per ogni frame genera SVG:
  <circle cx={p.x} cy={p.y} r={p.radius} fill={p.color} opacity={p.opacity}/>
  Se "network_form": <line> tra particelle a distanza < soglia

25fps × duration_sec frames → PNG temporanei → FFmpeg concat
```

**File da creare:** `video/templates/simulation-lab.js`

**Prompt Claude Code:**
```
Progetto: /home/miki/visual-scroll-blog
Task: creare video/templates/simulation-lab.js

Prima leggere:
- FASE16-template-catalog.md sezione "FASE 16J — simulation_lab"

Simulatore particelle (pura matematica, no librerie):
  class Particle {
    constructor(x, y, type) {
      this.x = x; this.y = y;
      this.vx = (Math.random()-0.5)*speed; this.vy = (Math.random()-0.5)*speed;
      this.radius = 12 + Math.random()*8;
      this.type = type;
    }
    update(bounds) {
      this.x += this.vx; this.y += this.vy;
      if (this.x < 0 || this.x > bounds.w) this.vx *= -1;
      if (this.y < 0 || this.y > bounds.h) this.vy *= -1;
    }
  }

Per "network_form": aggiungi attrattore a distanza > 200px, repulsore a distanza < 80px.
Per "cluster_emerge": N attrattori fissi, ogni particella assegnata all'attrattore più vicino.

Genera frame SVG, salva PNG, concat FFmpeg.
Aggiungere a index.js, agents/ai-news/config.js, agents/fitness/config.js, carousel.html.
NON usare librerie npm.
```

---

## FASE 16K — wireframe_3d

**Descrizione:** fake 3D in SVG puro — proiezione prospettica manuale di mesh wireframe. Griglia, nodi, linee neon su sfondo scuro. Effetto cyberpunk/tech. Rotazione lenta della camera simulata.

**Agente target:** ai-news

**Stack:** SVG proiezione prospettica + FFmpeg

**generatePlanPrompt:**
```
Articolo: {{title}}
Testo: {{video_script}}

Genera 5 scene per un video wireframe-3d in verticale 9:16.
Per ogni scena restituisci JSON con:
  - voiceover: (stringa, max 22 parole)
  - duration_sec: (intero 5-8)
  - shape: ("cube" | "sphere_grid" | "pyramid" | "neural_net" | "data_grid" | "torus")
  - rotation_axis: ("y" | "x" | "z" | "all")
  - color_scheme: ("neon_blue" | "neon_green" | "neon_purple" | "white")
  - label: (stringa, max 5 parole — testo overlay)
  - num_layers: (intero 2-5 — per neural_net e data_grid)
```

**Tecnica rendering:**

```
Proiezione prospettica in Node.js (matematica 3D manuale):

  function project3D(x, y, z, rotX, rotY, fov=800, cx=540, cy=960) {
    // Rotazione Y
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const x1 = x*cosY - z*sinY, z1 = x*sinY + z*cosY;
    // Rotazione X
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    const y1 = y*cosX - z1*sinX, z2 = y*sinX + z1*cosX;
    // Prospettiva
    const scale = fov / (fov + z2 + 400);
    return { x: cx + x1*scale, y: cy + y1*scale, z: z2, scale };
  }

Shape "cube": 8 vertici, 12 spigoli → disegna solo spigoli visibili (z-sorting)
Shape "sphere_grid": punti su sfera in coordinate sferiche, connetti vicini per longitudine/latitudine
Shape "neural_net": N layer verticali, nodi connessi tra layer adiacenti
Shape "data_grid": griglia piatta che si piega, punti come sfere piccole

Per ogni frame, incrementa angolo rotazione (rotation_axis):
  rotY += 0.02  (per axis="y")

Genera SVG frame per frame con edge depth-sorted (spigoli più lontani prima).
Spigolo lontano: opacity 0.3, spigolo vicino: opacity 1.0
Colori neon: stroke con opacity, glow via SVG filter blur
```

**File da creare:** `video/templates/wireframe-3d.js`

**Prompt Claude Code:**
```
Progetto: /home/miki/visual-scroll-blog
Task: creare video/templates/wireframe-3d.js

Prima leggere:
- FASE16-template-catalog.md sezione "FASE 16K — wireframe_3d"

Shapes da implementare (vertici + spigoli hard-coded come costanti):

  CUBE_VERTICES = [[-1,-1,-1],[-1,-1,1],[-1,1,-1],[-1,1,1],[1,-1,-1],[1,-1,1],[1,1,-1],[1,1,1]].map(v => v.map(x=>x*200))
  CUBE_EDGES = [[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]]

  SPHERE_GRID: genera punti con:
    for lat in range(-80, 81, 20): for lon in range(0, 360, 20):
      x = r * cos(lat) * cos(lon), y = r * sin(lat), z = r * cos(lat) * sin(lon)
    Connetti punti adiacenti nella griglia (lat/lon vicini)

  NEURAL_NET: per ogni layer l e nodo n:
    x = (l - numLayers/2) * 300
    y = (n - numNodes/2) * 150
    z = 0
    Connetti ogni nodo al layer successivo (tutti con tutti)

  DATA_GRID: griglia 10x10 di punti su piano XZ, y = sin(x+t)*30 (onda che si muove)

Depth sorting: ordina edges per z medio crescente prima di disegnare.
Glow: <filter id="glow"><feGaussianBlur stdDeviation="3"/></filter> — applica a stroke

Aggiungere a index.js, agents/ai-news/config.js, carousel.html.
NON usare librerie npm.
```

---

## FASE 16L — anatomy_motion

**Descrizione:** modelli anatomici 3D con muscoli/organi evidenziati, movimenti biomeccanici. Killer feature per l'agente Fitness. Richiede Blender CLI.

**Agente target:** fitness

**Stack:** Blender CLI + Python script + FFmpeg

**Prerequisito:**
```bash
# Installazione Blender (una volta sola)
sudo apt-get install blender
# oppure:
wget https://mirror.clarkson.edu/blender/release/Blender4.1/blender-4.1.0-linux-x64.tar.xz
tar -xf blender-4.1.0-linux-x64.tar.xz -C /opt/
```

**Asset da costruire (una volta con Claude Code + Blender):**
```
video/assets/blender/
  anatomy/
    skeleton_full.blend       ← scheletro completo, ogni osso è un oggetto separato
    muscles_lower.blend       ← quad, hamstring, glutes, calves
    muscles_upper.blend       ← biceps, triceps, pecs, lats, shoulders
    organs_cardio.blend       ← cuore, polmoni
    joints.blend              ← ginocchia, caviglie, spalle
  animations/
    highlight_pulse.py        ← illumina e fa pulsare body_parts indicati
    stress_point.py           ← micro-movimento di stress su joint
    running_cycle.py          ← ciclo di corsa parametrico
    organ_beat.py             ← battito/respiro
    calm_wave.py              ← onda rilassante su muscoli
  render_scene.py             ← script principale chiamato da Node.js
```

**generatePlanPrompt:**
```
Articolo: {{title}}
Testo: {{video_script}}

Genera 5 scene per un video anatomy-motion fitness in verticale 9:16.
Per ogni scena restituisci JSON con:
  - voiceover: (stringa, max 22 parole)
  - duration_sec: (intero 5-8)
  - body_parts: (array di parti tra: quadriceps, hamstrings, glutes, calves, biceps,
      triceps, pecs, lats, core, heart, lungs, brain, spine, knees, ankles, shoulders)
  - animation_type: ("highlight_muscles" | "organ_pulse" | "stress_point" |
      "running_motion" | "calm_pulse" | "strength_contract")
  - camera_angle: ("front" | "side" | "back" | "close_up")
  - intensity: ("low" | "medium" | "high")
  - highlight_color: (hex color — es. "#22c55e" per positivo, "#ef4444" per problema)
  - label: (stringa, max 5 parole — testo overlay anatomico)
```

**Tecnica rendering:**

```
Per ogni scena:
  1. Node.js scrive un JSON parametri per Blender
  2. Node.js chiama Blender headless:
     blender --background assets/skeleton_full.blend --python render_scene.py -- params.json
  3. Blender renderizza i frame PNG della scena
  4. Node.js chiama FFmpeg per assemblare i frame + TTS

render_scene.py (Python/Blender):
  Legge params JSON → importa gli oggetti body_parts rilevanti
  Nasconde tutto il resto (hide_render = True)
  Applica animation script corrispondente a animation_type
  Imposta camera per camera_angle
  Renderizza duration_sec * 25 frame

Qualità render Blender per MVP:
  Resolution: 1080×1920
  Samples: 32 (basso, render rapido)
  Engine: EEVEE (real-time, molto più veloce di Cycles)
  Formato frame: PNG
```

**File da creare:**
- `video/templates/anatomy-motion.js`
- `video/assets/blender/anatomy/render_scene.py`

**Prompt Claude Code (STEP 1 — asset Blender):**
```
Progetto: /home/miki/visual-scroll-blog
Task: creare i modelli anatomici base in Blender e lo script Python di render.

Prima verificare che Blender sia installato: which blender

Creare video/assets/blender/anatomy/render_scene.py:
  Il script viene chiamato con: blender --background <file.blend> --python render_scene.py -- <params.json>
  Deve:
  1. Leggere params.json (passato dopo --)
  2. Nascondere tutti gli oggetti
  3. Mostrare solo quelli in params.body_parts (bpy.data.objects[name].hide_render = False)
  4. Applicare materiale emissivo di colore params.highlight_color agli oggetti body_parts
  5. Impostare camera angle (params.camera_angle)
  6. Renderizzare params.duration_sec * 25 frame in /tmp/anatomy_frames/

Per i modelli .blend:
  Genera skeleton_full.blend usando la Blender Python API:
    - Crea oggetti mesh semplici (cilindri, sfere) per ogni parte anatomica
    - Nominali esattamente come i valori in body_parts[]
    - Posizionali in modo anatomicamente corretto (schema verticale 9:16)
    - Usa EEVEE come render engine, resolution 1080×1920

  Salva come video/assets/blender/anatomy/skeleton_full.blend
```

**Prompt Claude Code (STEP 2 — template Node.js):**
```
Progetto: /home/miki/visual-scroll-blog
Task: creare video/templates/anatomy-motion.js

Prima leggere:
- video/templates/slide-deck.js (pattern TTS + FFmpeg concat)
- FASE16-template-catalog.md sezione "FASE 16L — anatomy_motion"
- video/assets/blender/anatomy/render_scene.py (per capire i parametri)

Il template:
  id: 'anatomy_motion', label: 'Anatomy', requiresCarouselPng: false

  render():
  Per ogni scena:
    1. Scrive params JSON in file temporaneo
    2. Chiama Blender headless:
       execSync(`blender --background ${BLEND_FILE} --python ${RENDER_PY} -- ${paramsPath}`)
    3. I frame PNG sono in /tmp/anatomy_frames/frame_NNNN.png
    4. TTS da voiceover (stesso pattern slide-deck)
    5. FFmpeg assembla frame + audio:
       ffmpeg -framerate 25 -i /tmp/anatomy_frames/frame_%04d.png -i audio.mp3 -c:v libx264 ...
    6. Cleanup frame temporanei

  Se Blender non è installato: stampa avviso e genera fallback kinetic-typography per quella scena.

Aggiungere a index.js, agents/fitness/config.js (e aggiornare defaultVideoTemplate a 'anatomy_motion'),
carousel.html templateLabels.
```

---

## FASE 16M — product_xray

**Descrizione:** oggetto 3D che si "apre" in layer trasparenti, rivelando i componenti interni. Frecce con label. Effetto X-Ray/exploded view. Perfetto per AI hardware, wearable, prodotti tech.

**Agente target:** ai-news

**Stack:** Blender CLI + Python script + FFmpeg

**generatePlanPrompt:**
```
Articolo: {{title}}
Testo: {{video_script}}

Genera 5 scene per un video product-xray in verticale 9:16.
Per ogni scena restituisci JSON con:
  - voiceover: (stringa, max 22 parole)
  - duration_sec: (intero 5-8)
  - product_type: ("chip" | "phone" | "robot" | "server" | "wearable" | "generic_box")
  - layers: (array di 2-5 oggetti { name: string, label: string, color: string hex, reveal_order: int })
  - camera_motion: ("orbit" | "zoom_in" | "explode_out")
  - annotation_lines: (array di { component: string, description: string, max 3 parole })
  - scene_title: (stringa, max 5 parole)
```

**Asset Blender da costruire:**
```
video/assets/blender/products/
  chip.blend      ← CPU/chip con layer: substrate, circuits, die, heat_spreader, package
  phone.blend     ← smartphone con layer: screen, frame, battery, motherboard, camera
  generic_box.blend ← scatola generica con N layer customizzabili
  explode_anim.py ← anima i layer che si separano lungo l'asse Z
```

**Prompt Claude Code:**
```
Progetto: /home/miki/visual-scroll-blog
Task: creare video/templates/product-xray.js e asset Blender base.

Prima leggere:
- video/templates/anatomy-motion.js (stesso pattern Blender CLI)
- FASE16-template-catalog.md sezione "FASE 16M — product_xray"

Creare video/assets/blender/products/explode_anim.py:
  Legge params JSON con layers[] e camera_motion
  Per camera_motion = "explode_out":
    Anima ogni layer lungo asse Z: layer[i].location.z = reveal_order[i] * 80px * t
    t va da 0 a 1 durante la prima metà del video, poi rimane a 1
  Per camera_motion = "orbit":
    Ruota la camera attorno all'oggetto di 90° durante la scena

  Materiali: ogni layer con alpha = 0.7 (trasparente) tranne quello in focus (alpha = 1.0)

Creare generic_box.blend con 4 layer base (top, mid_upper, mid_lower, base) nominati così.
Il template usa generic_box come fallback per product_type non riconosciuto.

Creare video/templates/product-xray.js con stessa struttura di anatomy-motion.js.
Aggiungere a index.js, agents/ai-news/config.js, carousel.html.
```

---

## FASE 16N — lowpoly_3d

**Descrizione:** scene low-poly 3D generate proceduralmente in Blender Python. Personaggi stilizzati, ambienti semplici, storytelling metaforico. Il template più versatile e visivamente distintivo.

**Agente target:** tutti

**Stack:** Blender CLI + Python procedurale + FFmpeg

**generatePlanPrompt:**
```
Articolo: {{title}}
Testo: {{video_script}}

Genera 5 scene per un video low-poly 3D in verticale 9:16.
Per ogni scena restituisci JSON con:
  - voiceover: (stringa, max 22 parole)
  - duration_sec: (intero 5-8)
  - scene_metaphor: ("person_overwhelmed" | "robot_organizing" | "team_building" |
      "barrier_breaking" | "growth_plant" | "network_forming" | "runner_track" |
      "kitchen_cooking" | "athlete_form")
  - mood: ("tense" | "hopeful" | "energetic" | "calm" | "triumphant")
  - color_palette: ("warm" | "cool" | "neutral" | "agent_palette")
  - camera: ("close_up" | "medium" | "wide" | "birds_eye")
  - label: (stringa, max 6 parole — testo overlay)
```

**Asset da costruire (generati proceduralmente con Python/Blender):**
```
video/assets/blender/lowpoly/
  generate_scene.py     ← script principale — genera la scena da scene_metaphor
  characters/
    person_base.py      ← funzione che crea personaggio low-poly da primitivi
    robot_base.py       ← funzione che crea robot low-poly da primitivi
  environments/
    floor_simple.py     ← pavimento con sfumature
    abstract_bg.py      ← sfondo geometrico procedurale
```

**Tecnica generate_scene.py:**
```python
# Ogni scene_metaphor è una funzione che:
# 1. Chiama person_base.py o robot_base.py per creare i personaggi
# 2. Aggiunge oggetti props rilevanti (cubetti per ostacoli, sfere per nodi, ecc.)
# 3. Imposta keyframe di animazione
# 4. Applica palette colori (mood → palette)

PALETTES = {
  'warm':    {'sky': (0.98,0.85,0.7), 'ground': (0.85,0.65,0.4), 'accent': (0.9,0.3,0.2)},
  'cool':    {'sky': (0.7,0.85,0.98), 'ground': (0.4,0.55,0.75), 'accent': (0.2,0.5,0.9)},
  'agent_palette': letta da params.agentPalette
}

def scene_person_overwhelmed(params):
    # personaggio circondato da molti cubetti che cadono dall'alto
    create_person(position=(0,0,0), pose='stressed')
    for i in range(10):
        create_cube(size=0.3, position=random_around(0,0,3), falling=True)
    set_camera(params.camera, target=(0,0,1))
```

**Prompt Claude Code:**
```
Progetto: /home/miki/visual-scroll-blog
Task: creare video/templates/lowpoly-3d.js e script Python base.

Prima leggere:
- video/templates/anatomy-motion.js (pattern Blender CLI)
- FASE16-template-catalog.md sezione "FASE 16N — lowpoly_3d"

Creare video/assets/blender/lowpoly/generate_scene.py:
  Implementa almeno 4 scene_metaphor:
    - person_overwhelmed: personaggio (cilindro+sfera) + cubi che cadono
    - robot_organizing:   cubo metallico (robot) che sposta cubetti colorati in ordine
    - growth_plant:       sfera al centro che emette "rami" (cilindri) che crescono
    - network_forming:    sfere che si attraggono e formano connessioni (linee)

  Person base (low-poly, solo primitivi):
    testa = bpy.ops.mesh.primitive_uv_sphere_add(radius=0.3, location=(0,0,1.9))
    corpo = bpy.ops.mesh.primitive_cylinder_add(radius=0.2, depth=0.8, location=(0,0,1.3))
    Riduci a low-poly: bpy.ops.object.modifier_add(type='DECIMATE'), ratio=0.3

  Materiali: EEVEE, shading piatto (shade_flat), no specular
  Render: 1080×1920, 25fps, EEVEE, samples=16 (veloce)

Creare video/templates/lowpoly-3d.js con stesso pattern di anatomy-motion.js.
Aggiungere a index.js, tutti e tre i config agenti, carousel.html.
```

---

## Aggiornamenti finali a carousel.html — templateLabels completo

Dopo tutte le FASE 16, aggiornare `templateLabels` in `carousel.html`:

```js
const templateLabels = {
  slide_deck:           'Slideshow',
  kinetic_typography:   'Kinetic Text',
  data_story:           'Data Story',
  timeline_motion:      'Timeline',
  network_graph:        'Network Graph',
  minimal_documentary:  'Documentary',
  code_terminal:        'Terminal',
  whiteboard:           'Whiteboard',
  isometric_workflow:   'Isometric',
  map_explainer:        'Map',
  parallax_25d:         'Parallax',
  simulation_lab:       'Simulation',
  wireframe_3d:         'Wireframe 3D',
  anatomy_motion:       'Anatomy',
  product_xray:         'Product X-Ray',
  lowpoly_3d:           'Low-Poly 3D',
};
```

---

## Workflow di sviluppo — test-template.js

Ogni template si può sviluppare e testare **senza pipeline**, senza articoli approvati, senza GPT. Il template non sa da dove arrivano i dati — riceve solo `(article, scenes, agentConfig, outputPath)` e produce un MP4.

### Script `video/test-template.js`

```bash
# Uso
node video/test-template.js --template data_story
node video/test-template.js --template timeline_motion
node video/test-template.js --template network_graph
# ecc.
```

**Vantaggi:**
- Zero attesa pipeline — nessun articolo da approvare, nessun GPT plan
- Controllo totale sui dati di input — testa tutti i chart_type / layout / casi limite
- Iterazione veloce — modifica il template, riesegui in secondi
- Output in `output/renders/test-{template}.mp4` — verificabile subito

### Struttura dello script

```js
// video/test-template.js
'use strict';

require('dotenv').config();
const path = require('path');

const args    = process.argv.slice(2);
const tmplArg = args[args.indexOf('--template') + 1];
if (!tmplArg) { console.error('Uso: node video/test-template.js --template <nome>'); process.exit(1); }

const template    = require('./templates')[tmplArg];
const agentConfig = require('../agents')['ai-news'];

if (!template) { console.error('Template non trovato:', tmplArg); process.exit(1); }

const outputPath = path.resolve(`output/renders/test-${tmplArg}.mp4`);
console.log(`\n🧪 Test template: ${tmplArg}`);
console.log(`   Output: ${outputPath}\n`);

template.render(FAKE_ARTICLES[tmplArg], FAKE_SCENES[tmplArg], agentConfig, outputPath)
  .then(() => {
    const { execSync } = require('child_process');
    const info = execSync(`ls -lh "${outputPath}"`).toString().trim();
    console.log(`\n✅ ${info}`);
  })
  .catch(e => { console.error('\n❌ Render fallito:', e.message); process.exit(1); });
```

### Scene di test per ogni template

Hardcoded in `test-template.js` — coprono i casi principali di ogni template.

**data_story:**
```js
FAKE_SCENES['data_story'] = [{
  voiceover: "Il mercato AI chip cresce del 45% in un anno.",
  on_screen_text: "Crescita record",
  duration_sec: 5,
  chart_type: "bar",
  data_points: [{ label: "2022", value: 30 }, { label: "2023", value: 55 }, { label: "2024", value: 80 }],
  highlight: "80B$",
  trend: "up"
}, {
  voiceover: "OpenAI vale 80 miliardi. Google DeepMind 50.",
  on_screen_text: "Chi vale di più",
  duration_sec: 5,
  chart_type: "comparison",
  data_points: [{ label: "OpenAI", value: 80 }, { label: "DeepMind", value: 50 }],
  highlight: "OpenAI",
  trend: "neutral"
}, {
  voiceover: "L'adozione AI in azienda ha raggiunto il 63 percento.",
  on_screen_text: "63% adozione",
  duration_sec: 4,
  chart_type: "number_counter",
  data_points: [{ label: "adozione AI", value: 63 }],
  highlight: "63%",
  trend: "up"
}, {
  voiceover: "La curva di adozione accelera ogni trimestre.",
  on_screen_text: "Trend trimestrale",
  duration_sec: 5,
  chart_type: "line",
  data_points: [{ label: "Q1", value: 20 }, { label: "Q2", value: 35 }, { label: "Q3", value: 55 }, { label: "Q4", value: 80 }],
  highlight: "Q4",
  trend: "up"
}, {
  voiceover: "Chi non si adatta ora, perde terreno definitivamente.",
  on_screen_text: "Agisci adesso",
  duration_sec: 4,
  chart_type: "number_counter",
  data_points: [{ label: "aziende rimaste indietro", value: 37 }],
  highlight: "37%",
  trend: "down"
}];
```

**timeline_motion:**
```js
FAKE_SCENES['timeline_motion'] = [{
  voiceover: "GPT-1 nel 2018: 117 milioni di parametri. Solo ricerca.",
  duration_sec: 5,
  events: [{ date: "2018", label: "GPT-1 — 117M parametri", type: "milestone" }],
  camera_motion: "static",
  scene_title: "L'origine"
}, {
  voiceover: "GPT-3 sconvolge tutto. 175 miliardi. Testo quasi umano.",
  duration_sec: 5,
  events: [
    { date: "2020", label: "GPT-2 — 1.5B", type: "milestone" },
    { date: "2020", label: "GPT-3 — 175B", type: "milestone" }
  ],
  camera_motion: "pan_down",
  scene_title: "Il salto"
}, {
  voiceover: "ChatGPT cambia il mondo in 5 giorni. 100 milioni di utenti.",
  duration_sec: 5,
  events: [{ date: "Nov 2022", label: "ChatGPT — 100M utenti in 5 gg", type: "solution" }],
  camera_motion: "zoom_in",
  scene_title: "Il punto di svolta"
}, {
  voiceover: "GPT-4 supera il 90% degli umani all'esame di legge.",
  duration_sec: 5,
  events: [{ date: "Mar 2023", label: "GPT-4 — livello umano su benchmark", type: "milestone" }],
  camera_motion: "pan_down",
  scene_title: "Livello umano"
}, {
  voiceover: "Oggi GPT-5 ragiona. Dove siamo tra un anno?",
  duration_sec: 4,
  events: [{ date: "2025", label: "GPT-5 — reasoning", type: "now" }],
  camera_motion: "static",
  scene_title: "Adesso"
}];
```

**network_graph:**
```js
FAKE_SCENES['network_graph'] = [{
  voiceover: "Un sistema multi-agente: orchestratore, strumenti, output.",
  duration_sec: 6,
  nodes: [
    { id: "orch",   label: "Orchestrator", type: "agent",   x: 540, y: 500 },
    { id: "tool1",  label: "Web Search",   type: "tool",    x: 260, y: 900 },
    { id: "tool2",  label: "Code Exec",    type: "tool",    x: 820, y: 900 },
    { id: "output", label: "Risposta",     type: "output",  x: 540, y: 1300 }
  ],
  edges: [
    { from: "orch", to: "tool1" }, { from: "orch", to: "tool2" },
    { from: "tool1", to: "output" }, { from: "tool2", to: "output" }
  ],
  reveal_order: ["orch", "tool1", "tool2", "output"],
  scene_title: "Pipeline multi-agente"
}
/* + 4 scene simili */];
```

**minimal_documentary:**
```js
FAKE_SCENES['minimal_documentary'] = [{
  voiceover: "La Cina ha mappato l'intera rete energetica rinnovabile con l'AI.",
  headline: "La rete energetica mappata",
  subtext: "Un sistema AI gestisce 2 milioni di km di linee",
  duration_sec: 7,
  text_position: "bottom",
  ken_burns: "zoom_in",
  slide_index: 0
}
/* + 4 scene simili */];
```

**code_terminal:**
```js
FAKE_SCENES['code_terminal'] = [{
  voiceover: "Tre righe di codice. Un agente che legge il web per te.",
  duration_sec: 6,
  terminal_lines: [
    "$ node agent.js --task 'find AI news'",
    "→ Fetching feeds...",
    "→ Found 32 articles",
    "→ AI filter: 8 passed",
    "✓ Done in 4.2s"
  ],
  prompt_prefix: "$ ",
  highlight_line: 4,
  scene_title: "Agente in azione"
}
/* + 4 scene simili */];
```

**whiteboard:**
```js
FAKE_SCENES['whiteboard'] = [{
  voiceover: "Come funziona un LLM: input, attenzione, output.",
  duration_sec: 7,
  headline: "Come ragiona un LLM",
  elements: [
    { type: "rect",   label: "Input",      position: { x: 15, y: 30 }, size: "medium", reveal_order: 0 },
    { type: "arrow",  label: "",           position: { x: 50, y: 30 }, size: "small",  reveal_order: 1 },
    { type: "circle", label: "Attenzione", position: { x: 50, y: 50 }, size: "large",  reveal_order: 2 },
    { type: "arrow",  label: "",           position: { x: 50, y: 70 }, size: "small",  reveal_order: 3 },
    { type: "rect",   label: "Output",     position: { x: 85, y: 70 }, size: "medium", reveal_order: 4 }
  ],
  layout: "top_down"
}
/* + 4 scene simili */];
```

**simulation_lab:**
```js
FAKE_SCENES['simulation_lab'] = [{
  voiceover: "Come si diffonde una notizia AI: da un nodo a tutti.",
  duration_sec: 6,
  simulation_type: "particle_spread",
  num_particles: 20,
  particle_color_scheme: "blue_red",
  speed: "medium",
  scene_title: "Diffusione virale",
  annotation: "ogni nodo è un utente"
}
/* + 4 scene simili */];
```

**isometric_workflow, map_explainer, parallax_25d, wireframe_3d:** scene analoghe — costruite quando si implementa il template.

### Checklist per ogni nuovo template

```
□ Implementare video/templates/{nome}.js
□ Aggiungere a video/templates/index.js
□ Aggiungere FAKE_ARTICLE e FAKE_SCENES in video/test-template.js
□ node video/test-template.js --template {nome} → MP4 prodotto ✅
□ Aggiungere a agents/*/config.js → videoTemplates[]
□ Aggiungere a carousel.html → TEMPLATE_LABELS{}
□ Test end-to-end con articolo reale (opzionale per MVP)
```

---

## Note per Claude Code

- Ogni FASE 16x è indipendente — si può fare in qualsiasi ordine
- Ogni template va testato con `node video/render-video-v2.js --agent <agent> --slug <slug>` prima di considerarlo completo
- Per i template Blender (L, M, N): testare prima che `blender --version` risponda, altrimenti il template deve avere fallback su kinetic_typography
- I template SVG usano ImageMagick `convert` — verificare con `convert --version` prima di usarlo; se assente usare FFmpeg pipe per SVG semplici
- NON aggiungere dipendenze npm per nessun template
- `article.video_script` è a root level del JSON articolo (non dentro `formats`)
- `article.carousel_slides[i].image` è l'URL Pexels per la slide i
- Per ogni template aggiungere il test bash minimale: genera MP4, verifica ls -lh
