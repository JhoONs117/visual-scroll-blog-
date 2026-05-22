# FASE 15 — Visual Template Engine

**Documento di pianificazione per Claude Code**
Contesto: `PROJECT.md` + `MANUAL.md` + sessione di brainstorming 2026-05-22
Stato precedente: FASE 14 (Video Engine V2 / slide-deck) ✅ completa

**Stato FASE 15 (2026-05-22):** STEP 1–7 ✅ tutti completi
- STEP 1 ✅ videoTemplates/defaultVideoTemplate/videoPalette aggiunti ai 3 agent config
- STEP 2 ✅ build-data-agents.js: merge render_template + window.AGENT_CONFIGS
- STEP 3 ✅ render-pending.js: status filter, render_status migration, PNG check condizionale
- STEP 4 ✅ templates/index.js stub→real + render-video-v2.js routing + generate-video-plan.js
- STEP 5 ✅ server.js set-render-template endpoint + carousel.html template dropdown + videoHtml bugfix
- STEP 6 ✅ kinetic-typography.js: FFmpeg drawtext, TTS, tone/layout/emphasis, testato end-to-end
- STEP 7 ✅ Documentazione MANUAL.md §30 + PROJECT.md milestone

---

## Obiettivo

Trasformare il Video Engine V2 da sistema single-template (`slide_deck`) a un **Visual Template Engine modulare**, dove ogni agente dichiara nella propria config quali template video usa, e il renderer sceglie automaticamente quello corretto.

`slide_deck` è e rimane la **base gratuita** — genera video a costo ~$0.007 usando le PNG del carousel già create. I nuovi template aggiungono formati visivamente più ricchi mantenendo lo stesso costo per video.

Non si tratta di un refactor del codice esistente: `slide_deck` rimane intatto. Si aggiunge un livello di astrazione sopra.

---

## Principio guida

Coerente con come è stato costruito il resto del progetto:

- `core/run-agent.js` = runner unico, config dichiarativa per agente
- `channels/x.js`, `channels/instagram.js` = adapter modulari con interfaccia comune
- `agents/*/config.js` = fonte di verità per comportamento agente

**Lo stesso pattern si applica qui:**

```
agents/*/config.js         → dichiara i template disponibili per quell'agente
video/templates/*.js       → ogni template è un modulo con interfaccia comune
video/render-video-v2.js   → legge il template dall'articolo e delega al modulo corretto
```

---

## Decisioni architetturali — prese durante il brainstorming

### A. Il dropdown "Quality" diventa "Video Template"

Il dropdown `Low / Medium / High` viene rinominato e ristrutturato:

```
PRIMA:
  Label:   "Quality"
  Opzioni: ▶ Low | ▶ Medium | ▶ High
  (Low = slide_deck, Medium/High = stub inesistenti)

DOPO:
  Label:   "Video Template"
  Opzioni: popolate dinamicamente da window.AGENT_CONFIGS[agentId].videoTemplates

  Esempio ai-news:  ▶ Slideshow | ▶ Kinetic Text | ▶ Network Graph
  Esempio food:     ▶ Slideshow | ▶ Recipe Assembly
  Esempio fitness:  ▶ Slideshow | ▶ Anatomy Motion
```

Il dropdown cresce da solo man mano che si aggiungono template al config dell'agente.

### B. `render_quality` diventa campo legacy

Non sparisce per backward compat, ma non è più esposto in UX. Rimane sempre `"low"` internamente. Tutta la logica di selezione si basa su `render_template`.

### C. `render_status` keyed per nome template, non per quality

```json
// PRIMA (per quality — da migrare)
"render_status": { "low": "done" }

// DOPO (per template)
"render_status": { "slide_deck": "done", "kinetic_typography": null }
```

**Migrazione automatica inline in `render-pending.js`** — nessuno script separato:
```js
if (!article.render_status) article.render_status = {};
// Migra: render_status.low → render_status.slide_deck (una tantum, idempotente)
if (article.render_status.low === 'done' && !article.render_status.slide_deck) {
  article.render_status.slide_deck = 'done';
}
```

### D. PNG check condizionale — solo se `requiresCarouselPng: true`

Il check PNG non è un gate generale di `render-pending.js`. È una proprietà dichiarata dal template. Solo `slide_deck` ha `requiresCarouselPng: true`. Tutti i template futuri la hanno `false` per default.

```js
// PRIMA: gate incondizionale (blocca tutti i template futuri)
if (!hasCarouselPngs(agentId, slug)) continue;

// DOPO: solo se il template lo dichiara esplicitamente
if (template.requiresCarouselPng && !hasCarouselPngs(agentId, slug)) continue;
```

`hasCarouselPngs()` e `importFromDownloads()` rimangono nel file ma vengono chiamate solo per `slide_deck`.

### E. `window.AGENT_CONFIGS` separato da `window.AGENTS`

`window.AGENTS['ai-news']` è un array di articoli — non si può aggiungere `.videoTemplates` senza rompere tutto il frontend. Si aggiunge un secondo global:

```js
// Aggiunto da build-data-agents.js — NON modificare window.AGENTS
window.AGENT_CONFIGS = {
  'ai-news':  { videoTemplates: ['slide_deck', 'kinetic_typography', 'network_graph'], defaultVideoTemplate: 'kinetic_typography' },
  'food':     { videoTemplates: ['slide_deck', 'recipe_assembly'],                     defaultVideoTemplate: 'slide_deck' },
  'fitness':  { videoTemplates: ['slide_deck', 'anatomy_motion'],                      defaultVideoTemplate: 'slide_deck' },
};
```

`carousel.html` legge `window.AGENT_CONFIGS[agentId].videoTemplates` per costruire il dropdown.

### F. `render_template` scritto PRIMA della chiamata GPT

`generate-video-plan.js` deve scrivere `render_template` sull'articolo **prima** di chiamare GPT-4o-mini, non dopo. Attualmente manda `Template: undefined` al modello.

```js
// Ordine corretto:
const templateName = agentConfig.defaultVideoTemplate || 'slide_deck';
article.formats.video.render_template = templateName;  // ← PRIMA
// poi chiama callOpenAI(agentId, article)               ← DOPO
```

### G. Stack rendering — nessuna libreria Node.js esterna

Per tutti i template fino ai "Medi" (template 1-12 nel catalogo):
- **SVG puro** generato come stringhe in Node.js (zero dipendenze)
- **ImageMagick CLI** (`convert`) per SVG → PNG frames (sistema, non npm)
- **FFmpeg** (già installato) per assemblaggio video

Per i template "Difficili" (template 13-15):
- **Blender CLI** headless, chiamato via `child_process` (500MB, gratuito, una tantum)

Nessuna dipendenza nuova in `package.json`. Nessun costo aggiuntivo su Railway.

---

## Bug identificati da correggere durante l'implementazione

### Bug 1 — `video_script` path errato nel codice di esempio originale

Il documento originale scriveva:
```js
article.formats.video_script.map(...)  // ❌ SBAGLIATO
```
Il campo è **a root level** del JSON articolo:
```js
article.video_script.map(...)  // ✅ CORRETTO
```
Verificato leggendo i JSON reali in `output/`.

### Bug 2 — `build-data-agents.js` non mergia `render_template`

Nel merge dei duplicati (righe 46-50) vengono mergiati `render_quality` e `render_version` ma NON `render_template`. Se esistono più file per lo stesso slug e solo uno ha `render_template` impostato, il valore viene perso silenziosamente.

**Fix da aggiungere:**
```js
if (other.render_template && !article.render_template) article.render_template = other.render_template;
```

### Bug 3 — `render-pending.js` blocca su PNG per tutti i template

Riga 91 attuale: `if (!hasCarouselPngs(agentId, slug)) continue;` — incondizionale. Questo è il blocco principale che impedisce a qualsiasi template futuro di funzionare. Risolto con decisione D sopra.

### Bug 4 — `status: "published"` blocca il render video

`generate-video-plan.js` e `render-pending.js` filtrano solo `status === 'approved'`. Un articolo già pubblicato su TikTok (status = "published") non può ricevere un video nuovo.

**Fix:** estendere il filtro:
```js
if (!['approved', 'published'].includes(article.status)) continue;
```

### Bug 5 — Contraddizione nella documentazione sull'approvazione

`PROJECT.md` §2 dice: "L'approvazione su Railway è effimera — il flusso corretto è sempre locale → commit → push."
`MANUAL.md` §30 dice: "Clicca Approva su Railway → viene pushato su git automaticamente."

Questi si contraddicono. Il push automatico da Railway fallisce silenziosamente quando il CI gira in parallelo (bug noto, già documentato in memory). FASE 15 non risolve questo bug strutturale ma `MANUAL.md §30` va aggiornato con il workaround.

---

## Costi per video — tutti i template

Costi fissi condivisi da tutti i template:

| Voce | Costo per video | Note |
|---|---|---|
| GPT-4o-mini scene plan | ~$0.0002 | 5 scene × ~200 token, già gira in CI |
| OpenAI TTS voiceover | ~$0.006 | ~400 char × $0.015/1000 char |
| FFmpeg render | $0 | locale |
| **Totale base** | **~$0.007** | uguale per tutti i template |

Il render del template aggiunge solo tempo CPU locale — zero costi API aggiuntivi per i template 1-12. I template 13-15 (Blender) aggiungono ~1-10 minuti di CPU locale, nessun costo.

---

## Catalogo template — 15 template in 3 categorie

### Categoria 1 — Facili e scalabili (stack: SVG + ImageMagick + FFmpeg)

Dipendenza di sistema: `sudo apt-get install imagemagick` (probabilmente già presente in WSL)

| # | Nome | ID | Descrizione | Agente target |
|---|---|---|---|---|
| 1 | Slideshow | `slide_deck` | Slide carousel animate zoompan + TTS | tutti (già esiste) |
| 2 | Kinetic Typography | `kinetic_typography` | Testo grande animato su sfondo dark, frase per frase | ai-news |
| 3 | Data Story | `data_story` | Grafici/barre/numeri che crescono animati | ai-news |
| 4 | Timeline Motion | `timeline_motion` | Linea del tempo con eventi che appaiono | ai-news |
| 5 | Network Graph | `network_graph` | Nodi e connessioni che si formano | ai-news |
| 6 | Minimal Documentary | `minimal_documentary` | Testo overlay su immagini Pexels già disponibili | tutti |
| 7 | Code Terminal | `code_terminal` | Codice/terminale che si scrive, syntax highlight | ai-news |
| 8 | Whiteboard | `whiteboard` | Disegno che appare su sfondo bianco (SVG stroke-dashoffset) | tutti |

### Categoria 2 — Medi e potenti (stack: SVG complesso + ImageMagick + FFmpeg)

Stessa dipendenza di sistema della categoria 1.

| # | Nome | ID | Descrizione | Agente target |
|---|---|---|---|---|
| 9 | Isometric Workflow | `isometric_workflow` | Diagrammi isometrici 3D-illusion in SVG | ai-news |
| 10 | Map Explainer | `map_explainer` | Mappe SVG geografiche con regioni animate | tutti |
| 11 | 2.5D Parallax | `parallax_25d` | Layer a velocità diverse — puro FFmpeg overlay | tutti |
| 12 | Simulation Lab | `simulation_lab` | Particelle/fisica semplice, frame SVG pre-calcolati | ai-news |
| 13 | 3D Wireframe | `wireframe_3d` | Proiezione prospettica manuale in SVG (fake 3D) | ai-news |

### Categoria 3 — Difficili e differenzianti (stack: Blender CLI + FFmpeg)

Dipendenza: Blender ~500MB, `sudo apt-get install blender` o da blender.org

| # | Nome | ID | Descrizione | Agente target |
|---|---|---|---|---|
| 14 | Anatomy in Motion | `anatomy_motion` | Modelli anatomici 3D (asset CC gratuiti) | fitness |
| 15 | Product X-Ray | `product_xray` | Prodotto con layer trasparenti rivelati | ai-news |
| 16 | 3D Low-Poly Story | `lowpoly_3d` | Scene low-poly 3D generate proceduralmente in Python/Blender | tutti |

**Ordine di implementazione:** un template alla volta, partendo da 2 (kinetic_typography). Stesso principio degli agenti — sistema modulare, aggiunte incrementali.

---

## Schema JSON articolo — campi video

`render_template` rimane a **root level** (non dentro `formats.video`) per coerenza con il codice esistente che lo legge già così.

```json
{
  "status": "approved",
  "render_template": "kinetic_typography",
  "render_quality": "low",
  "render_status": {
    "slide_deck": "done",
    "kinetic_typography": null
  },
  "render_path": "output/renders/slug.mp4",
  "formats": {
    "video": {
      "scenes": [],
      "duration_sec": 0,
      "quality_score": 0,
      "cta": ""
    }
  },
  "video_script": ["...", "...", "...", "...", "..."]
}
```

**Nota importante:** `video_script` è a root level dell'articolo, NON dentro `formats`. Verificato sui JSON reali.

---

## Config agente — nuovi campi

```js
// agents/ai-news/config.js
module.exports = {
  // ... tutto il config esistente NON si tocca ...

  // AGGIUNGERE in fondo:
  videoTemplates: ['slide_deck', 'kinetic_typography', 'network_graph', 'data_story'],
  defaultVideoTemplate: 'kinetic_typography',
  videoPalette: {
    bg:     '#0f172a',
    text:   '#f8fafc',
    accent: '#3b82f6',
  },
};

// agents/food/config.js
module.exports = {
  // ... config esistente ...
  videoTemplates: ['slide_deck', 'recipe_assembly'],
  defaultVideoTemplate: 'slide_deck',  // finché recipe_assembly non è implementato
  videoPalette: {
    bg:     '#10150f',
    text:   '#f7efe3',
    accent: '#e07b39',
  },
};

// agents/fitness/config.js
module.exports = {
  // ... config esistente ...
  videoTemplates: ['slide_deck', 'anatomy_motion'],
  defaultVideoTemplate: 'slide_deck',  // finché anatomy_motion non è implementato
  videoPalette: {
    bg:     '#0a0f0a',
    text:   '#f0fdf4',
    accent: '#22c55e',
  },
};
```

---

## Struttura `video/templates/`

```
video/
  templates/
    index.js              ← aggiorna registry (non toccare slide-deck)
    slide-deck.js         ← NON TOCCARE — funziona
    kinetic-typography.js ← FASE 15A — primo nuovo template
    network-graph.js      ← FASE 15B — stub poi implementa
    data-story.js         ← FASE 15C — stub poi implementa
    [altri]               ← aggiunti uno alla volta
```

---

## Interfaccia comune template — specifica definitiva

```js
module.exports = {
  id: 'kinetic_typography',          // stringa unica, snake_case
  label: 'Kinetic Typography',       // label leggibile per dropdown UI
  requiresCarouselPng: false,        // true SOLO per slide_deck

  // generatePlanPrompt — OPZIONALE
  // Se presente, generate-video-plan.js usa questo prompt invece di quello generico.
  // Permette al template di richiedere campi extra nelle scenes[] (es. body_parts, animation_type).
  // Se assente, si usa il prompt standard (on_screen_text, voiceover, hook, duration_sec).
  generatePlanPrompt: null,

  // render() — unico metodo obbligatorio
  // article  = JSON completo dell'articolo
  // scenes   = article.formats.video.scenes[] (già generati da generate-video-plan.js)
  // agentConfig = require('../agents')[agentId]
  // outputPath  = path assoluto del file MP4 di output
  async render(article, scenes, agentConfig, outputPath) {
    // implementazione specifica del template
  },
};
```

**`generatePlanPrompt` è il meccanismo che rende i template parametrici.** Ogni template descrive a GPT quali campi aggiuntivi generare nelle `scenes[]`. Il render usa quei campi per decidere cosa mostrare — zero hardcoding, ogni video diverso dall'altro.

---

## Architettura parametrica

### Principio

Un template non è una scena fissa. È un programma che legge i parametri dell'articolo e decide cosa mostrare. Due articoli con lo stesso template generano video completamente diversi.

Esempio `anatomy_motion` — tre articoli, tre video diversi:

| Articolo | `body_parts` | `animation_type` | `highlight_color` |
|---|---|---|---|
| "Squat attiva 3 muscoli" | `["quadriceps","hamstrings","glutes"]` | `highlight_muscles` | `#22c55e` |
| "Troppa palestra fa male alle ginocchia" | `["knees","ankles"]` | `stress_point` | `#ef4444` |
| "Yoga abbassa il cortisolo" | `["brain","adrenal_glands"]` | `calm_pulse` | `#3b82f6` |

### Come funziona — flusso completo

```
1. generate-video-plan.js legge il template dell'articolo
2. Se template.generatePlanPrompt esiste → usa quel prompt per chiamare GPT
   Altrimenti → usa il prompt standard (on_screen_text, voiceover, hook)
3. GPT genera scenes[] con i campi specifici del template
4. render-pending.js chiama template.render(article, scenes, ...)
5. Il template legge i campi dalle scenes[] e costruisce il video di conseguenza
```

### generatePlanPrompt — struttura

```js
// In anatomy-motion.js:
generatePlanPrompt: `
Articolo: {{title}}
Testo: {{video_script}}

Genera 5 scene per un video anatomico fitness in verticale 9:16.
Per ogni scena restituisci JSON con:
  - voiceover: (stringa, max 22 parole, narrazione TTS)
  - on_screen_text: (stringa, max 9 parole, testo overlay)
  - duration_sec: (numero intero 4-8)
  - body_parts: (array di parti anatomiche rilevanti all'articolo tra:
      quadriceps, hamstrings, glutes, calves, biceps, triceps, pecs, lats,
      core, heart, lungs, brain, spine, knees, ankles, shoulders)
  - animation_type: (uno tra: highlight_muscles, organ_pulse, stress_point,
      recovery_flow, running_motion, calm_pulse, strength_contract)
  - camera_angle: (uno tra: front, side, back, top, close_up)
  - intensity: (uno tra: low, medium, high)
`,
```

`generate-video-plan.js` sostituisce `{{title}}` e `{{video_script}}` con i dati dell'articolo prima di inviare il prompt.

### Asset library Blender

Quello che viene costruito una volta con Claude + blender-mcp e poi riusato forever:

```
blender/
  assets/
    anatomy/
      muscles_lower.blend    ← quad, hamstring, glutes, calves
      muscles_upper.blend    ← biceps, triceps, pecs, lats, shoulders
      organs_cardio.blend    ← cuore, polmoni, arterie
      skeleton_full.blend    ← scheletro completo, parti selezionabili
      joints.blend           ← ginocchia, caviglie, spalle — per stress_point
    animations/              ← script Python riusabili
      highlight_pulse.py     ← fa pulsare con colore i body_parts indicati
      stress_fracture.py     ← micro-crepe animate sui joint
      organ_beat.py          ← battito/respiro con scala keyframe
      running_cycle.py       ← ciclo di corsa parametrico (velocità variabile)
      calm_wave.py           ← onda rilassante, palette fredda
```

Il Python script di render carica solo gli asset necessari per quell'articolo — il video pesa meno e il render è più veloce.

### Esempio — anatomy_motion.py (pseudocodice)

```python
import bpy, json, sys

params_path = sys.argv[sys.argv.index('--') + 1]
scenes = json.load(open(params_path))

for i, scene in enumerate(scenes):
    bpy.ops.wm.open_mainfile(filepath='assets/skeleton_full.blend')

    # Carica solo i body_parts rilevanti — nasconde tutto il resto
    for part in scene['body_parts']:
        bpy.data.objects[part].hide_render = False

    # Applica animation_type
    if scene['animation_type'] == 'highlight_muscles':
        run_script('animations/highlight_pulse.py', scene['body_parts'], scene['highlight_color'])
    elif scene['animation_type'] == 'stress_point':
        run_script('animations/stress_fracture.py', scene['body_parts'])

    # Posiziona camera
    set_camera_angle(scene['camera_angle'])

    # Renderizza i frame della scena
    bpy.context.scene.frame_end = scene['duration_sec'] * 30
    bpy.ops.render.render(animation=True, write_still=False)
```

### Kinetic Typography — anche questo è parametrico

Non serve SVG hardcoded. I campi delle scenes[] guidano il rendering:

| Campo GPT | Effetto nel video |
|---|---|
| `tone: "urgent"` | testo più grande, animazione più veloce, accent rosso |
| `tone: "informative"` | testo normale, fade lento, accent blu |
| `emphasis_word: "record"` | quella parola appare più grande / con colore accent |
| `layout: "split"` | testo diviso su due righe con timing separato |

`generatePlanPrompt` di `kinetic_typography` chiede a GPT di includere `tone`, `emphasis_word`, `layout` per ogni scena.

---

## kinetic_typography — implementazione FASE 15A

### Sorgente dati

Usa `article.video_script` (root level, già presente in tutti gli articoli) come testo per ogni scena. Usa `scenes[i].voiceover` per il TTS (già generato, più elaborato dello script raw).

```js
// Priorità sorgente testo:
const sceneText = scenes[i].on_screen_text || article.video_script[i] || scenes[i].hook;
const voiceoverText = scenes[i].voiceover;
```

### Stack rendering

```
Per ogni scena:
  1. Node.js genera stringa SVG (testo centrato su sfondo palette)
  2. ImageMagick `convert` SVG → PNG frame base
  3. Per animazione: genera N frames con opacità/posizione variabile (loop Node.js)
  4. OpenAI TTS genera audio MP3 per voiceover (riusa logica slide-deck.js)
  5. FFmpeg assembla frames + audio → clip scena .mp4

Concat finale:
  6. FFmpeg concat tutte le clip → output finale 1080×1920 MP4
```

### Palette per agente

Letta da `agentConfig.videoPalette` (aggiunto al config agente in questo step).

```
ai-news:  bg #0f172a, text #f8fafc, accent #3b82f6
food:     bg #10150f, text #f7efe3, accent #e07b39
fitness:  bg #0a0f0a, text #f0fdf4, accent #22c55e
```

### Animazioni via FFmpeg (zero librerie aggiuntive)

```bash
# Fade in testo con FFmpeg drawtext
ffmpeg -f lavfi -i color=c=0x0f172a:size=1080x1920:rate=30 \
  -vf "drawtext=text='...':fontsize=90:fontcolor=white:
       x=(w-text_w)/2:y=(h-text_h)/2:
       alpha='if(lt(t,0.4),t/0.4,if(lt(t,2.6),1,(3-t)/0.4))'" \
  -t 3 scene_01.mp4
```

Oppure via SVG frames + ImageMagick per animazioni più elaborate (font personalizzati, layout, gradienti).

---

## Modifiche a `render-video-v2.js`

Il file attualmente usa già il registry `require('./templates')`. Aggiornare solo il routing esplicito e la lettura di `render_template`:

```js
// PRIMA (riga 78):
const templateName = article.render_template || agentConfig.video?.[quality] || 'slide_deck';

// DOPO:
const templateName = article.render_template || agentConfig.defaultVideoTemplate || 'slide_deck';
```

Il registry in `templates/index.js` va aggiornato per includere i nuovi template man mano che vengono creati.

---

## Modifiche a `generate-video-plan.js`

Due fix distinti:

**Fix 1 — Scrive `render_template` PRIMA della chiamata GPT:**
```js
// In loadCandidates(), dopo aver letto l'articolo:
if (!article.formats) article.formats = {};
if (!article.formats.video) article.formats.video = {};

// Scrivi render_template ora, prima di chiamare OpenAI
const agentConfig = require('../agents')[agentId];
if (!article.render_template) {
  article.render_template = agentConfig.defaultVideoTemplate || 'slide_deck';
}
```

**Fix 2 — Estende filtro a `status: "published"`:**
```js
// PRIMA:
if (article.status !== 'approved') continue;

// DOPO:
if (!['approved', 'published'].includes(article.status)) continue;
```

**Fix 3 — Usa `generatePlanPrompt` del template se presente:**
```js
// Dopo aver scritto render_template sull'articolo:
const templateModule = require('./templates')[article.render_template];
const customPrompt = templateModule?.generatePlanPrompt;

// Passa customPrompt a callOpenAI — se null usa il prompt standard
const scenes = await callOpenAI(agentId, article, customPrompt);
```

In `callOpenAI()`, aggiungere il parametro opzionale:
```js
async function callOpenAI(agentId, article, customPrompt = null) {
  const prompt = customPrompt
    ? customPrompt
        .replace('{{title}}', article.title)
        .replace('{{video_script}}', (article.video_script || []).join('\n'))
    : buildDefaultPrompt(agentId, article);  // logica esistente invariata
  // ... resto invariato
}
```

Questo permette a ogni template di richiedere campi extra nelle `scenes[]` senza toccare la logica centrale. I template senza `generatePlanPrompt` (come `slide_deck`) usano il prompt standard — zero breaking change.

---

## Modifiche a `render-pending.js`

Tre fix distinti:

**Fix 1 — Migrazione `render_status` + check per template:**
```js
// Sostituisce: if (article.render_status?.[article.render_quality] === 'done') continue;
if (!article.render_status) article.render_status = {};

// Migrazione inline: low → slide_deck (idempotente)
if (article.render_status.low === 'done' && !article.render_status.slide_deck) {
  article.render_status.slide_deck = 'done';
}

const templateName = article.render_template || agentConfig.defaultVideoTemplate || 'slide_deck';
if (article.render_status[templateName] === 'done') continue;
```

**Fix 2 — PNG check condizionale:**
```js
// Sostituisce: if (!hasCarouselPngs(agentId, slug)) continue;
const template = require('./templates')[templateName];
if (!template) { console.warn(...); failed++; continue; }

if (template.requiresCarouselPng && !hasCarouselPngs(agentId, slug)) {
  console.log(`  ⏸ [${slug}] PNG mancanti — richieste da ${templateName}, skip`);
  continue;
}
```

**Fix 3 — Estende filtro a `status: "published"`:**
```js
// PRIMA:
if (article.status !== 'approved') continue;

// DOPO:
if (!['approved', 'published'].includes(article.status)) continue;
```

---

## Modifiche a `build-data-agents.js`

**Fix 1 — Mergia `render_template` dai duplicati:**
```js
// Aggiungere nella sezione merge (dopo riga 50):
if (other.render_template && !article.render_template) article.render_template = other.render_template;
```

**Aggiunta — Scrive `window.AGENT_CONFIGS`:**
```js
// Alla fine del file, dopo la scrittura di data-agents.js:
const agentsRegistry = require('../agents');
const agentConfigs = {};
for (const agentId of Object.keys(DIRS)) {
  const cfg = agentsRegistry[agentId];
  if (cfg) {
    agentConfigs[agentId] = {
      videoTemplates:      cfg.videoTemplates      || ['slide_deck'],
      defaultVideoTemplate: cfg.defaultVideoTemplate || 'slide_deck',
    };
  }
}
// Appende AGENT_CONFIGS allo stesso file data-agents.js
const existing = fs.readFileSync(dataAgentsPath, 'utf8');
fs.writeFileSync(
  dataAgentsPath,
  existing + `\nwindow.AGENT_CONFIGS = ${JSON.stringify(agentConfigs, null, 2)};`
);
```

---

## Modifiche a `server.js`

Aggiungere nuovo endpoint **mantenendo il vecchio per backward compat**:

```js
// MANTIENI il vecchio endpoint (articoli esistenti lo usano ancora):
// POST /api/set-render-quality  ← rimane invariato

// AGGIUNGERE nuovo endpoint:
if (req.method === 'POST' && urlPath === '/api/set-render-template') {
  // body: { agent, slug, template }
  // scrive: article.render_template = template
  //         article.render_quality = 'low'  (legacy, sempre low)
  //         article.render_status[template] = null  (reset per re-render)
  // poi: build-data-agents.js + git push (stesso pattern di set-render-quality)
}
```

---

## Modifiche a `frontend/carousel.html`

**Cambio 1 — Dropdown label e opzioni dinamiche:**
```js
// PRIMA: select hardcoded Low/Medium/High
// DOPO: select popolato da window.AGENT_CONFIGS[agentId].videoTemplates

function buildTemplateDropdown(agentId, article) {
  const templates = (window.AGENT_CONFIGS?.[agentId]?.videoTemplates) || ['slide_deck'];
  const templateLabels = {
    slide_deck:           'Slideshow',
    kinetic_typography:   'Kinetic Text',
    network_graph:        'Network Graph',
    data_story:           'Data Story',
    recipe_assembly:      'Recipe Assembly',
    anatomy_motion:       'Anatomy Motion',
  };
  return templates.map(id =>
    `<option value="${id}"${article.render_template === id ? ' selected' : ''}>
      ▶ ${templateLabels[id] || id}
    </option>`
  ).join('');
}
```

**Cambio 2 — Bottone "Salva per video" condizionale:**
```js
// Mostra "Salva per video" solo se il template selezionato richiede PNG
const REQUIRES_PNG = { slide_deck: true };  // tutti gli altri: false
function updateSavePngButton(selectedTemplate) {
  const btn = document.getElementById('saveForVideo');
  if (btn) btn.style.display = REQUIRES_PNG[selectedTemplate] ? '' : 'none';
}
```

**Cambio 3 — Chiamata endpoint aggiornata:**
```js
// Al cambio template nel dropdown:
async function setRenderTemplate(slug, agent, template, articleObj, selectEl) {
  await fetch('/api/set-render-template', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent, slug, template }),
  });
  articleObj.render_template = template;
  updateSavePngButton(template);
}
```

---

## Flusso approvazione aggiornato

```
carousel.html (Railway)
  → Approva articolo        → POST /api/set-status  (invariato)
  → Seleziona template      → POST /api/set-render-template
  → "Salva per video"       → appare SOLO se template.requiresCarouselPng (es. slide_deck)

Locale:
  git pull
  node video/generate-video-plan.js --agent ai-news --ci
    → scrive render_template PRIMA di chiamare GPT
    → filtra approved + published
  node video/render-pending.js
    → migrazione inline render_status.low → render_status.slide_deck
    → skip PNG check se !requiresCarouselPng
    → renderizza con template corretto
    → build-data-agents.js + git commit + push
```

**Nota:** l'approvazione da Railway continua a essere fragile (push silente se CI gira in parallelo). Workaround documentato in MANUAL.md §30 rimane valido — impostare status/template direttamente in locale se il pull non porta le modifiche.

---

## Steps di implementazione

---

### STEP 1 ✅ — Config agenti
File: `agents/ai-news/config.js`, `agents/food/config.js`, `agents/fitness/config.js`
Rischio: zero — non tocca pipeline

**Prompt Claude Code:**
```
Progetto: /home/miki/visual-scroll-blog
Task: aggiungere videoTemplates, defaultVideoTemplate, videoPalette ai config di tutti e tre gli agenti.

File da modificare (SOLO questi tre, nient'altro):
- agents/ai-news/config.js
- agents/food/config.js
- agents/fitness/config.js

In agents/ai-news/config.js aggiungere IN FONDO all'oggetto esportato (prima della chiusura }):
  videoTemplates: ['slide_deck', 'kinetic_typography', 'network_graph', 'data_story'],
  defaultVideoTemplate: 'kinetic_typography',
  videoPalette: { bg: '#0f172a', text: '#f8fafc', accent: '#3b82f6' },

In agents/food/config.js aggiungere:
  videoTemplates: ['slide_deck', 'recipe_assembly'],
  defaultVideoTemplate: 'slide_deck',
  videoPalette: { bg: '#10150f', text: '#f7efe3', accent: '#e07b39' },

In agents/fitness/config.js aggiungere:
  videoTemplates: ['slide_deck', 'anatomy_motion'],
  defaultVideoTemplate: 'slide_deck',
  videoPalette: { bg: '#0a0f0a', text: '#f0fdf4', accent: '#22c55e' },

NON toccare nessun altro campo del config. NON modificare altri file.
```

**Test automatico:**
```bash
node -e "
const a = require('./agents');
['ai-news','food','fitness'].forEach(id => {
  const c = a[id];
  console.assert(Array.isArray(c.videoTemplates), id + ': videoTemplates mancante');
  console.assert(typeof c.defaultVideoTemplate === 'string', id + ': defaultVideoTemplate mancante');
  console.assert(c.videoPalette?.bg, id + ': videoPalette.bg mancante');
  console.log('✅ ' + id + ':', c.videoTemplates, '| default:', c.defaultVideoTemplate);
});
"
```

---

### STEP 2 ✅ — Build e dati
File: `scripts/build-data-agents.js`
Rischio: basso — fix bug silenzioso merge + aggiunta window.AGENT_CONFIGS

**Prompt Claude Code:**
```
Progetto: /home/miki/visual-scroll-blog
Task: due modifiche a scripts/build-data-agents.js.

Fix 1 — nel loop merge duplicati (dove si mergiano render_quality e render_version), aggiungere:
  if (other.render_template && !article.render_template) article.render_template = other.render_template;

Fix 2 — dopo la scrittura di frontend/data-agents.js, appendere window.AGENT_CONFIGS allo stesso file:
  Leggere agents/ai-news/config.js, agents/food/config.js, agents/fitness/config.js
  Per ogni agente estrarre: videoTemplates, defaultVideoTemplate
  Appendere al file data-agents.js già scritto la riga:
    window.AGENT_CONFIGS = { 'ai-news': { videoTemplates: [...], defaultVideoTemplate: '...' }, ... };

NON modificare la struttura di window.AGENTS (array di articoli per agente, non si tocca).
NON modificare altri file.
```

**Test automatico:**
```bash
node scripts/build-data-agents.js
node -e "
const fs = require('fs');
const content = fs.readFileSync('frontend/data-agents.js', 'utf8');
console.assert(content.includes('AGENT_CONFIGS'), 'AGENT_CONFIGS mancante');
console.assert(content.includes('videoTemplates'), 'videoTemplates mancante');
console.log('✅ data-agents.js contiene AGENT_CONFIGS');
const window = {};
eval(content);
console.log('ai-news templates:', window.AGENT_CONFIGS['ai-news'].videoTemplates);
console.log('window.AGENTS intatto (array):', Array.isArray(window.AGENTS['ai-news']));
"
```

---

### STEP 3 ✅ — Backend render
File: `video/render-pending.js`, `video/generate-video-plan.js`
Rischio: medio — fix bug critici, testare prima di procedere

**Prompt Claude Code — render-pending.js:**
```
Progetto: /home/miki/visual-scroll-blog
Task: tre fix a video/render-pending.js. NON toccare la logica di hasCarouselPngs/importFromDownloads.

Fix 1 — estendere filtro status in loadCandidates():
  Sostituire: if (article.status !== 'approved') continue;
  Con: if (!['approved', 'published'].includes(article.status)) continue;

Fix 2 — migrazione render_status + check per template (in loadCandidates()):
  Sostituire: if (article.render_status?.[article.render_quality] === 'done') continue;
  Con il blocco:
    if (!article.render_status) article.render_status = {};
    if (article.render_status.low === 'done' && !article.render_status.slide_deck) {
      article.render_status.slide_deck = 'done';
    }
    const agentCfg = require('../agents')[agentId];
    const tmplName = article.render_template || agentCfg?.defaultVideoTemplate || 'slide_deck';
    if (article.render_status[tmplName] === 'done') continue;

Fix 3 — PNG check condizionale (in loadCandidates()):
  Sostituire: if (!hasCarouselPngs(agentId, slug)) continue;
  Con:
    const tmpl = require('./templates')[tmplName];
    if (!tmpl) { console.warn('Template ' + tmplName + ' non trovato per ' + slug); continue; }
    if (tmpl.requiresCarouselPng && !hasCarouselPngs(agentId, slug)) continue;

  Aggiungere templateName al push dei candidates: candidates.push({ ..., templateName: tmplName });
  Nel loop principale usare candidates[i].templateName invece di ricalcolarlo.

NON toccare la logica di hasCarouselPngs/importFromDownloads.
```

**Prompt Claude Code — generate-video-plan.js:**
```
Progetto: /home/miki/visual-scroll-blog
Task: tre fix a video/generate-video-plan.js.

Fix 1 — scrivere render_template PRIMA della chiamata a callOpenAI.
In loadCandidates(), dopo le verifiche di status/quality/scenes, aggiungere:
  const agentCfg = require('../agents')[agentId];
  if (!article.render_template) {
    article.render_template = agentCfg?.defaultVideoTemplate || 'slide_deck';
  }

Fix 2 — estendere filtro status:
  Sostituire: if (article.status !== 'approved') continue;
  Con: if (!['approved', 'published'].includes(article.status)) continue;

Fix 3 — usare generatePlanPrompt del template se presente.
Dopo aver scritto render_template, prima della chiamata callOpenAI:
  const templateModule = require('./templates')[article.render_template];
  const customPrompt = templateModule?.generatePlanPrompt || null;
  // Passare customPrompt a callOpenAI come terzo parametro opzionale.

In callOpenAI(), aggiungere parametro opzionale customPrompt = null:
  Se customPrompt !== null:
    usare customPrompt sostituendo {{title}} con article.title
    e {{video_script}} con (article.video_script || []).join('\n')
  Se customPrompt === null:
    usare il prompt esistente invariato.

NON toccare validateVideoPlan o il formato delle scenes. Il template
slide_deck ha generatePlanPrompt: null — deve funzionare esattamente come prima.
```

**Test automatico:**
```bash
# Test migrazione render_status
node -e "
const article = {
  status: 'approved', render_quality: 'low', render_template: 'slide_deck',
  render_status: { low: 'done' }, formats: { video: { scenes: [1,2,3,4,5] } }
};
if (!article.render_status) article.render_status = {};
if (article.render_status.low === 'done' && !article.render_status.slide_deck)
  article.render_status.slide_deck = 'done';
console.assert(article.render_status.slide_deck === 'done', '❌ migrazione fallita');
console.log('✅ migrazione render_status.low → slide_deck ok');
"

# Test che render-pending giri senza crash
node video/render-pending.js

# Test che generate-video-plan accetti status published
node -e "
const fs = require('fs'), path = require('path');
const files = fs.readdirSync('output').filter(f => f.endsWith('.json'));
let found = false;
for (const f of files) {
  const a = JSON.parse(fs.readFileSync(path.join('output', f)));
  if (a.status === 'published') {
    console.log('✅ articolo published trovato:', a.slug, '— verrà processato dopo fix');
    found = true; break;
  }
}
if (!found) console.log('ℹ️ nessun articolo published — ok');
"
```

**Test manuale M3 — render-pending non blocca su kinetic_typography:**
1. Prendi un articolo con `render_template: 'kinetic_typography'` e scenes già generate
2. Verifica che NON esistano PNG in `output/ai-news/slides-png/<slug>/`
3. Esegui `node video/render-pending.js`
4. **Atteso:** il render parte o stampa "template non ancora implementato" — NON "Nessun articolo pronto" per colpa delle PNG mancanti

**Test manuale M6 — articolo published viene processato:**
1. Trova un articolo con `status: "published"` (già postato su TikTok)
2. Imposta `render_template: 'kinetic_typography'` nel JSON con il workaround
3. Esegui `node video/generate-video-plan.js --agent ai-news --ci`
4. **Atteso:** l'articolo viene trovato e le scene vengono generate

---

### STEP 4 ✅ — Registry e routing
File: `video/templates/index.js`, `video/render-video-v2.js`
Rischio: basso — aggiunge solo stub, backward compat totale

**Prompt Claude Code:**
```
Progetto: /home/miki/visual-scroll-blog
Task: due piccole modifiche.

video/templates/index.js — aggiungere stub per kinetic_typography:
  'kinetic_typography': stub('kinetic_typography'),
  (la funzione stub() esiste già nel file, aggiungere questa riga all'oggetto exports)

video/render-video-v2.js — riga 78, sostituire:
  const templateName = article.render_template || agentConfig.video?.[quality] || 'slide_deck';
  Con:
  const templateName = article.render_template || agentConfig.defaultVideoTemplate || 'slide_deck';

NON modificare altro. NON toccare slide-deck.js.
```

**Test automatico:**
```bash
node -e "
const t = require('./video/templates');
console.log('Template registrati:', Object.keys(t));
console.assert(t['slide_deck'], '❌ slide_deck mancante');
console.assert(t['kinetic_typography'], '❌ kinetic_typography mancante');
console.log('✅ registry ok');
"
```

---

### STEP 5 ✅ — Server e frontend
File: `server.js`, `frontend/carousel.html`
Rischio: medio — cambia UX del carousel, testare visivamente

**Prompt Claude Code:**
```
Progetto: /home/miki/visual-scroll-blog
Task: aggiungere endpoint set-render-template in server.js e aggiornare carousel.html.

server.js — aggiungere nuovo endpoint POST /api/set-render-template DOPO l'endpoint
esistente set-render-quality (NON rimuovere set-render-quality):
  body: { agent, slug, template }
  Trova il file più recente per slug (stessa logica di set-render-quality)
  Scrive: article.render_template = template
          article.render_quality = 'low'  (sempre, per backward compat)
          if (article.render_status) article.render_status[template] = null
  Poi: build-data-agents.js + git push (copia esatta del pattern di set-render-quality)

carousel.html — quattro modifiche:
  1. Label del select: da "Quality" a "Video Template"
  2. Opzioni del select popolate da window.AGENT_CONFIGS[agentId].videoTemplates
     (invece di Low/Medium/High hardcoded)
     Labels: { slide_deck:'Slideshow', kinetic_typography:'Kinetic Text',
     network_graph:'Network Graph', data_story:'Data Story',
     recipe_assembly:'Recipe Assembly', anatomy_motion:'Anatomy Motion' }
     Fallback se AGENT_CONFIGS non disponibile: solo ['slide_deck']
  3. Bottone #saveForVideo: display:'' se template selezionato === 'slide_deck',
     display:'none' per tutti gli altri. Aggiornare sia al caricamento sia al cambio select.
  4. Al cambio select: chiamare /api/set-render-template invece di /api/set-render-quality

NON rimuovere setRenderQuality. NON toccare save-carousel-png.
```

**Test automatico:**
```bash
# Verifica endpoint presente in server.js
grep -n "set-render-template" server.js && echo "✅ endpoint presente" || echo "❌ endpoint mancante"
# Verifica che set-render-quality sia ancora presente
grep -n "set-render-quality" server.js && echo "✅ vecchio endpoint mantenuto" || echo "❌ vecchio endpoint rimosso!"
# Verifica AGENT_CONFIGS referenziato in carousel.html
grep -n "AGENT_CONFIGS" frontend/carousel.html && echo "✅ carousel usa AGENT_CONFIGS" || echo "❌ AGENT_CONFIGS non trovato in carousel"
```

**Test manuale M1 — dropdown template in carousel.html:**
1. Apri `https://visual-scroll-blog-production.up.railway.app/carousel.html?agent=ai-news`
2. Seleziona un articolo dal menu
3. **Verifica:** label dropdown = "Video Template" (non "Quality")
4. **Verifica:** opzioni = "Slideshow", "Kinetic Text", ecc. (non Low/Medium/High)
5. **Verifica:** con "Slideshow" selezionato → "Salva per video" visibile
6. Seleziona "Kinetic Text" → **Verifica:** "Salva per video" sparisce
7. Torna a "Slideshow" → **Verifica:** "Salva per video" riappare

**Test manuale M2 — selezione template persiste su git:**
1. Su Railway: seleziona articolo, scegli "Kinetic Text", aspetta conferma UI
2. Nel terminale: `git pull`
3. **Verifica:** `node -e "const fs=require('fs'),a=JSON.parse(fs.readFileSync('output/$(ls -t output/*.json | head -1 | xargs basename)')); console.log(a.render_template)"`
4. **Atteso:** `kinetic_typography`

---

### STEP 6 ✅ — Template kinetic-typography
File: `video/templates/kinetic-typography.js`
Rischio: isolato — sostituisce solo lo stub, non tocca nulla di esistente

**Prompt Claude Code:**
```
Progetto: /home/miki/visual-scroll-blog
Task: creare video/templates/kinetic-typography.js sostituendo lo stub esistente.

Prima leggere:
- video/templates/slide-deck.js (logica TTS, concat FFmpeg, cleanup temp files)
- Brainstorming/FASE15-video-template-engine.md sezione "Architettura parametrica"
  per capire come usare generatePlanPrompt e i campi parametrici delle scenes[]

Il template da implementare:
- id: 'kinetic_typography', label: 'Kinetic Text', requiresCarouselPng: false

- generatePlanPrompt: stringa che chiede a GPT di includere per ogni scena:
    tone: ('urgent' | 'informative' | 'inspiring')
    emphasis_word: (parola da enfatizzare con colore accent)
    layout: ('single' | 'split')  — split = due righe con timing separato

- render(article, scenes, agentConfig, outputPath):
  Per ogni scena in scenes[] (5 scene):
  1. Genera audio TTS da scenes[i].voiceover (stessa API/parametri di slide-deck)
  2. Determina parametri visivi dai campi parametrici:
     - Sfondo: agentConfig.videoPalette?.bg || '#0f172a'
     - Testo: scenes[i].on_screen_text || article.video_script?.[i] || scenes[i].hook
     - Font size: 80px (tone='urgent') | 70px (altri)
     - Colore accent: agentConfig.videoPalette?.accent per emphasis_word
     - Fade in/out: 0.4s (urgent) | 0.6s (informative/inspiring)
     - Durata: scenes[i].duration_sec secondi
  3. Genera clip video con FFmpeg drawtext su sfondo solid color:
     - Risoluzione: 1080x1920, framerate 30
     - Testo centrato (x=(w-text_w)/2, y=(h-text_h)/2)
     - Fade in/out via parametro alpha in drawtext
     - Se emphasis_word presente: secondo drawtext sovrapposto con colore accent
  4. Combina clip video + audio in MP4 temporaneo
  Concat tutti i clip in outputPath finale (codec h264, audio aac 44100Hz)
  Cleanup file temporanei come in slide-deck.js

- Aggiornare video/templates/index.js: sostituire stub('kinetic_typography') con
  require('./kinetic-typography')

NON usare librerie npm. Solo FFmpeg CLI via child_process + fs + path.
NON modificare slide-deck.js.
Se scenes[] non hanno i campi parametrici (articoli vecchi senza generatePlanPrompt),
usare valori di default: tone='informative', nessun emphasis_word, layout='single'.
```

**Test automatico:**
```bash
# Trova slug di un articolo con scenes generate
SLUG=$(node -e "
const fs=require('fs'),path=require('path');
const files=fs.readdirSync('output').filter(f=>f.endsWith('.json')).sort().reverse();
for(const f of files){
  const a=JSON.parse(fs.readFileSync(path.join('output',f)));
  if(a.status==='approved' && a.formats?.video?.scenes?.length===5){
    process.stdout.write(a.slug); break;
  }
}" 2>/dev/null)
echo "Slug trovato: $SLUG"

# Imposta kinetic_typography sull'articolo
node -e "
const fs=require('fs'),path=require('path');
const files=fs.readdirSync('output').filter(f=>f.endsWith('.json')&&f.includes('$SLUG'));
if(files.length){
  const fp=path.join('output',files[0]);
  const a=JSON.parse(fs.readFileSync(fp));
  a.render_template='kinetic_typography';
  if(!a.render_status) a.render_status={};
  a.render_status.kinetic_typography=null;
  fs.writeFileSync(fp,JSON.stringify(a,null,2)+'\n');
  console.log('✅ render_template impostato a kinetic_typography');
}"

# Renderizza
node video/render-video-v2.js --agent ai-news --slug $SLUG

# Verifica output
ls -lh output/renders/$SLUG.mp4 && echo "✅ MP4 generato" || echo "❌ MP4 non trovato"
```

**Test manuale M4 — video kinetic_typography leggibile:**
1. Dopo il test automatico, apri `carousel.html` su Railway dopo push
2. Trova l'articolo renderizzato
3. **Verifica:** player video funziona (niente errore 404)
4. **Verifica:** testo leggibile, sfondo scuro, accent blu per ai-news
5. **Verifica:** voiceover sincronizzato con testo a schermo
6. **Verifica:** durata video tra 18 e 35 secondi

**Test manuale M5 — slide_deck non si rompe:**
1. Prendi un articolo con PNG carousel già salvate e `render_status.slide_deck` non done
2. Imposta `render_template: 'slide_deck'` sul JSON
3. Esegui `node video/render-pending.js`
4. **Verifica:** render slide_deck funziona come prima di FASE 15
5. **Verifica:** il JSON ha `render_status.slide_deck = 'done'` (non `render_status.low`)

---

### STEP 7 ✅ — Documentazione
File: `MANUAL.md §30`, `PROJECT.md`
Rischio: zero

Aggiornare MANUAL.md §30:
- Sostituire riferimenti a "dropdown quality" con "dropdown Video Template"
- Aggiornare il flusso giornaliero: al punto 3 "Seleziona ▶ Low" → "Seleziona il template"
- Aggiornare la tabella qualità/template con i nuovi nomi
- Aggiungere nota: "Salva per video appare solo per template Slideshow"

Aggiornare PROJECT.md tabella milestone: FASE 15 → ✅ Completa

---

## File da creare / modificare — riepilogo

| File | Azione | Step |
|---|---|---|
| `agents/ai-news/config.js` | Modifica | 1 |
| `agents/food/config.js` | Modifica | 1 |
| `agents/fitness/config.js` | Modifica | 1 |
| `scripts/build-data-agents.js` | Modifica | 2 |
| `video/render-pending.js` | Modifica | 3 |
| `video/generate-video-plan.js` | Modifica | 3 |
| `video/templates/index.js` | Modifica | 4 |
| `video/render-video-v2.js` | Modifica | 4 |
| `server.js` | Modifica | 5 |
| `frontend/carousel.html` | Modifica | 5 |
| `video/templates/kinetic-typography.js` | Crea | 6 |
| `MANUAL.md §30` | Modifica | 7 |

---

## Cosa NON toccare

- `video/templates/slide-deck.js` — funziona, non modificare
- `video/validate-video-plan.js` — riutilizzabile così com'è
- `video/generate-slides-916.js` — usato solo da slide-deck, lasciare
- `window.AGENTS` in `build-data-agents.js` — struttura array articoli, non modificare
- Endpoint `POST /api/set-render-quality` in `server.js` — mantenerlo per backward compat
- Endpoint `POST /api/save-carousel-png` — invariato
- `core/run-agent.js`, `agents/*/config.js` (campi esistenti) — non toccare il resto

---

## Note per Claude Code

- Il progetto usa Node.js puro, nessun bundler, nessun framework — `require()` per tutto
- NON aggiungere dipendenze npm per il rendering video — solo FFmpeg CLI + ImageMagick CLI (sistemi)
- I JSON articolo sono in `output/{agentId}/` formato `{timestamp}_{slug}.json`
- Per ai-news l'output dir è `output/` (root), non `output/ai-news/`
- `window.AGENTS` è generato da `scripts/build-data-agents.js` → `frontend/data-agents.js`
- Railway auto-deploya su ogni push — test sempre in locale prima
- FFmpeg installato per FASE 14, ImageMagick probabilmente già presente in WSL
- OpenAI TTS in `slide-deck.js` — riusare quella logica esatta
- `article.video_script` è a root level del JSON, NON dentro `formats`
- Backward compat: articoli senza `render_template` → fallback a `agentConfig.defaultVideoTemplate || 'slide_deck'`
- Backward compat: articoli con `render_status.low = 'done'` → migrazione inline a `render_status.slide_deck`
