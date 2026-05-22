# FASE 16 — Categoria 3: Template Blender

**Documento separato dalla pianificazione principale FASE 16**
Contesto: `PROJECT.md` · `MANUAL.md` · `FASE15-video-template-engine.md` · `FASE16-template-catalog.md`
Stato precedente: FASE 16 Categoria 1 e 2 raccomandate prima di questo documento

---

## Perché documento separato

I template Blender (anatomy_motion, product_xray, lowpoly_3d) hanno requisiti radicalmente diversi dagli altri:

- **Dipendenza pesante:** Blender ~500MB, non presente di default
- **Tempo di render:** 30-120s per scena vs 5-15s dei template FFmpeg
- **Asset da costruire:** modelli .blend, script Python Blender API — non generabili al volo
- **Workflow diverso:** Node.js chiama Blender headless → Blender renderizza PNG frame → FFmpeg concat
- **Fallback obbligatorio:** se Blender non installato, ogni template deve degradare a `kinetic_typography`

Tutti gli altri template (Categoria 1 e 2) usano solo FFmpeg + ImageMagick e si implementano senza prerequisiti aggiuntivi. Fare prima quelli.

---

## Prerequisiti da installare (una volta sola)

### Blender

```bash
# Opzione A — da apt (versione di sistema, potrebbe essere datata)
sudo apt-get update && sudo apt-get install blender

# Opzione B — versione recente da tarball (consigliata)
wget https://mirror.clarkson.edu/blender/release/Blender4.1/blender-4.1.0-linux-x64.tar.xz
sudo tar -xf blender-4.1.0-linux-x64.tar.xz -C /opt/
sudo ln -s /opt/blender-4.1.0-linux-x64/blender /usr/local/bin/blender

# Verifica
blender --version
```

### Verifica headless (WSL2)

Blender su WSL2 senza display richiede un display virtuale o flag specifici:

```bash
# Test render headless
blender --background --python-expr "import bpy; print('Blender OK')"
```

Se restituisce errori display su WSL2:
```bash
sudo apt-get install xvfb
export DISPLAY=:99
Xvfb :99 -screen 0 1080x1920x24 &
```

O usare `blender --background` che bypassa il display per render headless (funziona senza Xvfb in genere).

---

## Struttura asset Blender

```
video/assets/blender/
  anatomy/
    skeleton_full.blend          ← scheletro completo, ogni osso = oggetto separato
    muscles_lower.blend          ← quad, hamstring, glutes, calves
    muscles_upper.blend          ← biceps, triceps, pecs, lats, shoulders
    organs_cardio.blend          ← cuore, polmoni
    render_scene.py              ← script Python chiamato da Node.js per ogni scena
  products/
    generic_box.blend            ← fallback universale per product_xray
    chip.blend                   ← CPU/chip con layer substrate/circuits/die
    phone.blend                  ← smartphone con layer screen/frame/battery/board
    explode_anim.py              ← anima layer che si separano lungo asse Z
  lowpoly/
    generate_scene.py            ← genera scena da scene_metaphor params
    characters/
      person_base.py             ← crea personaggio low-poly da primitivi Blender
      robot_base.py              ← crea robot low-poly da primitivi Blender
    environments/
      floor_simple.py            ← pavimento con sfumature
      abstract_bg.py             ← sfondo geometrico procedurale
```

Gli asset `.blend` vengono costruiti **una volta** con script Python Blender API (non a mano). Una volta pronti sono riutilizzati per tutti i render futuri.

---

## Parametri render Blender consigliati (MVP)

| Parametro | Valore MVP | Valore qualità alta |
|---|---|---|
| Engine | EEVEE | Cycles |
| Samples | 16-32 | 128-256 |
| Resolution | 1080×1920 | 1080×1920 |
| FPS | 25 | 25 |
| Format frame | PNG | PNG |
| Tempo stimato/scena | 15-30s | 120-300s |

Partire sempre con EEVEE + samples=16 per testare — qualità accettabile e render ~10x più veloce di Cycles.

---

## Pattern Node.js → Blender (comune a tutti e tre i template)

```js
// Pattern comune a anatomy-motion.js, product-xray.js, lowpoly-3d.js
const { execSync } = require('child_process');
const BLENDER = process.env.BLENDER_PATH || 'blender';

async function renderWithBlender(blendFile, pythonScript, params, framesDir) {
  const paramsPath = path.join(framesDir, 'params.json');
  fs.mkdirSync(framesDir, { recursive: true });
  fs.writeFileSync(paramsPath, JSON.stringify(params));

  try {
    execSync(
      `${BLENDER} --background "${blendFile}" --python "${pythonScript}" -- "${paramsPath}"`,
      { stdio: 'pipe', timeout: 300000 }  // 5 min max per scena
    );
  } catch (e) {
    throw new Error(`Blender render fallito: ${e.message.slice(0, 200)}`);
  }
}

// Fallback se Blender non disponibile
function blenderAvailable() {
  try { execSync(`${BLENDER} --version`, { stdio: 'pipe' }); return true; }
  catch { return false; }
}
```

La variabile `BLENDER_PATH` in `.env` permette di puntare a installazioni non standard (es. `/opt/blender-4.1.0-linux-x64/blender`).

---

## FASE 16L — anatomy_motion

*(Dettaglio completo in `FASE16-template-catalog.md` sezione "FASE 16L")*

**Agente target:** fitness (primario)
**Descrizione:** modelli anatomici 3D con muscoli/organi evidenziati. Killer feature per Fitness.

### Campi scene (generatePlanPrompt)

```
body_parts:      array di parti tra: quadriceps, hamstrings, glutes, calves, biceps,
                 triceps, pecs, lats, core, heart, lungs, brain, spine, knees, ankles, shoulders
animation_type:  "highlight_muscles" | "organ_pulse" | "stress_point" |
                 "running_motion" | "calm_pulse" | "strength_contract"
camera_angle:    "front" | "side" | "back" | "close_up"
intensity:       "low" | "medium" | "high"
highlight_color: hex (es. "#22c55e" positivo, "#ef4444" problema)
label:           stringa, max 5 parole — testo overlay anatomico
```

### Implementazione in due step

**STEP 1 — asset Blender** (creare skeleton_full.blend + render_scene.py):
- Modelli da primitivi Blender (cilindri+sfere per ossa, mesh semplici per muscoli)
- Ogni parte anatomica = oggetto Blender nominato esattamente come i valori in `body_parts[]`
- render_scene.py: legge params JSON, mostra solo i body_parts rilevanti, applica materiale emissivo highlight_color, renderizza frame PNG

**STEP 2 — template Node.js** (`video/templates/anatomy-motion.js`):
- Chiama Blender headless per ogni scena
- Raccoglie frame PNG in `/tmp/anatomy_frames/`
- TTS da voiceover (stesso pattern slide-deck.js)
- FFmpeg assembla frame + audio
- Fallback automatico a `kinetic_typography` se Blender non disponibile

**Config agenti da aggiornare:**
```js
// agents/fitness/config.js
videoTemplates: ['slide_deck', 'kinetic_typography', 'whiteboard', 'minimal_documentary', 'simulation_lab', 'anatomy_motion'],
defaultVideoTemplate: 'anatomy_motion',  // ← solo dopo test ok
```

---

## FASE 16M — product_xray

*(Dettaglio completo in `FASE16-template-catalog.md` sezione "FASE 16M")*

**Agente target:** ai-news
**Descrizione:** oggetto 3D che si "apre" in layer trasparenti. Perfetto per AI hardware, wearable, chip.

### Campi scene (generatePlanPrompt)

```
product_type:      "chip" | "phone" | "robot" | "server" | "wearable" | "generic_box"
layers:            array di { name, label, color, reveal_order }
camera_motion:     "orbit" | "zoom_in" | "explode_out"
annotation_lines:  array di { component, description (max 3 parole) }
```

### Asset da costruire

- `generic_box.blend` — fallback per product_type non riconosciuto (4 layer: top/mid_upper/mid_lower/base)
- `chip.blend` — CPU con layer: substrate, circuits, die, heat_spreader, package
- `phone.blend` — smartphone con layer: screen, frame, battery, motherboard, camera
- `explode_anim.py` — anima separazione layer lungo asse Z

**Dipende da:** anatomy_motion (stesso pattern Node.js/Blender) — fare dopo 16L.

---

## FASE 16N — lowpoly_3d

*(Dettaglio completo in `FASE16-template-catalog.md` sezione "FASE 16N")*

**Agente target:** tutti (il più versatile)
**Descrizione:** scene low-poly 3D procedurali. Il template visivamente più distintivo.

### Campi scene (generatePlanPrompt)

```
scene_metaphor:  "person_overwhelmed" | "robot_organizing" | "team_building" |
                 "barrier_breaking" | "growth_plant" | "network_forming" |
                 "runner_track" | "kitchen_cooking" | "athlete_form"
mood:            "tense" | "hopeful" | "energetic" | "calm" | "triumphant"
color_palette:   "warm" | "cool" | "neutral" | "agent_palette"
camera:          "close_up" | "medium" | "wide" | "birds_eye"
```

### Approccio procedurale (nessun asset manuale)

Tutto generato da Python/Blender API: `generate_scene.py` costruisce la scena da zero da `scene_metaphor`, crea i personaggi da primitivi, imposta keyframe e render. Non richiede `.blend` preesistenti — solo lo script Python.

Personaggio base (low-poly da primitivi):
```python
# testa
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.3, location=(0,0,1.9))
# corpo
bpy.ops.mesh.primitive_cylinder_add(radius=0.2, depth=0.8, location=(0,0,1.3))
# decimate per low-poly look
bpy.ops.object.modifier_add(type='DECIMATE')
bpy.context.object.modifiers['Decimate'].ratio = 0.3
```

**Dipende da:** anatomy_motion (stesso pattern) — fare dopo 16L.

---

## Ordine di implementazione consigliato

```
1. Verificare Blender installato + headless funzionante su WSL2
2. FASE 16L — anatomy_motion (fitness) ← primo perché più semplice da testare (muscoli = sfere/cilindri)
3. FASE 16M — product_xray (ai-news)  ← riusa pattern da 16L
4. FASE 16N — lowpoly_3d (tutti)      ← il più elaborato, procedurale puro
```

---

## Variabili d'ambiente da aggiungere

```env
# .env
BLENDER_PATH=/usr/local/bin/blender   # o /opt/blender-4.1.0.../blender
BLENDER_SAMPLES=16                    # 16=veloce/test, 64=produzione
```

Aggiungere anche su Railway se si vuole render in produzione (sconsigliato per ora — Blender su Railway richiede buildpack custom o Docker).

---

## Note importanti

- **Railway non ha Blender** — questi template funzionano solo in locale. Il video MP4 prodotto in locale viene poi pushato su git come tutti gli altri.
- Il fallback a `kinetic_typography` è obbligatorio: se `blender --version` fallisce, la scena usa kinetic_typography invece di crashare.
- Render time realistico su WSL2: ~30-60s per scena con EEVEE samples=16 → 150-300s per video 5 scene. Accettabile per uso locale occasionale.
- I modelli anatomici semplificati (primitivi Blender) sono sufficienti per l'MVP. Modelli high-quality (da Sketchfab/MixamO) possono essere aggiunti dopo.
- `anatomy_motion` con `defaultVideoTemplate` su fitness va impostato DOPO aver validato il render in locale, non prima.
