# Food Agent — Piano di implementazione

Documento operativo per l'aggiunta del secondo agente "5 Step Food" al sistema Visual AI Scroll Blog.  
Aggiornato: 2026-05-12 | Correlato a: **PROJECT.md** · **MANUAL.md**

> **Principio guida:** `run.js` e tutta la pipeline AI news non vengono toccati.  
> Tutto quello che riguarda il food agent è nuovo e separato.
>
> **Stato attuale:** tutti gli step completati (STEP 1–8).  
> Il food agent è live in CI, genera 3 articoli per run, il feed multi-agente è operativo.

---

## Regole non negoziabili

Queste regole hanno priorità su qualsiasi altra considerazione implementativa.  
Claude Code deve rispettarle in ogni file che crea o modifica.

```
1. Non rompere mai AI news.
2. Se food fallisce, logga e continua — mai bloccare la pipeline principale.
3. Non inventare ricette: se il contenuto non è una ricetta reale, skip.
4. Non generare carousel incompleti: se carousel_slides non sono esattamente 5, skip.
5. Scrivi sempre data-food.js, anche se l'array è vuoto.
6. Prima release: MAX_NEW_FOOD_ARTICLES=1 per test, poi 3 in CI.
```

---

## Stato implementazione

| Step | Descrizione | Stato |
|---|---|---|
| STEP 1 | `fetch-food.js` — feed RSS food + fetch contenuto | ✅ |
| STEP 1A | Test isolato `fetchArticleContent` — gate scraping | ✅ |
| STEP 2 | `generate-food.js` — prompt 5 step ricetta | ✅ |
| STEP 3 | `run-food.js` — pipeline completa food | ✅ |
| STEP 4 | `frontend/carousel-food.html` — carousel food | ✅ |
| STEP 5 | GitHub Actions — pipeline food in CI | ✅ |
| STEP 6 | `frontend/index.html` — agent-bar con switch AI News / 5 Step Food | ✅ |
| STEP 7 | Navigazione multi-pagina e agent switch su review + carousel | ✅ |
| STEP 8 | Palette food nel feed — gradienti, badge e dot color per story food | ✅ |

**Ordine di esecuzione:**
```
STEP 1 → STEP 1A (gate) → STEP 2 → STEP 3 → STEP 4 → STEP 5
STOP: accumula 10 articoli corretti → STEP 6 → STEP 7 → STEP 8
```

---

## Struttura file

### File nuovi (creati dal food agent)
```
/
├── fetch-food.js              ← feed RSS food, whitelist food, fetchArticleContent
├── generate-food.js           ← generateRecipeSlides, generateRecipeCarouselSlides,
│                                 generateFoodCaption, generateFoodVideoScript, generateFoodThread
├── run-food.js                ← pipeline completa: fetch → genera → salva
├── output/
│   └── food/                  ← JSON generati (separati da output/)
└── frontend/
    ├── data-food.js           ← window.FOOD_ARTICLES = [...] (generato da run-food.js)
    └── carousel-food.html     ← export PNG carousel food con palette olive/arancio
```

### File esistenti modificati (STEP 6–8)
| File | Modifica |
|---|---|
| `frontend/index.html` | agent-bar fixed in cima, renderFeed(), palette `.food-story`, nav links |
| `frontend/review.html` | header sticky con agent switch + nav, refactor renderReview() |
| `frontend/carousel.html` | select agente (naviga su carousel-food), link Carousel Food |
| `frontend/carousel-food.html` | select agente (naviga su carousel.html), link Carousel AI |

### File non toccati
`run.js`, `fetch.js`, `filter.js`, `generate.js`, `deepseek.js`, `validate.js`, `frontend/data.js`

---

## STEP 1A — Test isolato `fetchArticleContent`

> **Da eseguire subito dopo aver creato `fetch-food.js` e prima di proseguire con STEP 2.**  
> Verifica che Giallozafferano non blocchi lo scraping.  
> Se questo test fallisce, inutile procedere — bisogna risolvere prima.

L'ordine corretto è:
```
STEP 1  → crea fetch-food.js
STEP 1A → testa fetchArticleContent su URL reale
STEP 2  → solo se STEP 1A passa
```

Testa con un URL reale preso dal feed — non una pagina categoria:

```bash
node -e "
const Parser = require('rss-parser');
const { fetchArticleContent } = require('./fetch-food');
const parser = new Parser();

parser.parseURL('https://www.giallozafferano.it/feed').then(async feed => {
  const first = feed.items[0];
  console.log('URL testato:', first.link);
  const txt = await fetchArticleContent(first.link);
  console.log('length:', txt.length);
  console.log(txt.slice(0, 1000));
});
"
```

**Atteso:** `length` > 800, testo con parole come "ingredienti", "preparazione", "grammi".  
**Se length = 0 o < 100:** Giallozafferano sta bloccando — vedi fix nella tabella errori comuni.

Il prompt STEP 1 deve includere esplicitamente:
```js
module.exports = { fetchFoodArticles, fetchArticleContent };
```

---

## STEP 1 — `fetch-food.js`

### Cosa fa
Recupera articoli da feed RSS food italiani, filtra per parole chiave rilevanti, restituisce lista di `{ title, link, pubDate, content }`.

### Differenze rispetto a `fetch.js`
- Feed RSS diversi (Giallozafferano, Cookaround, ecc.)
- `WHITELIST` food invece di AI (`ricetta`, `ingredienti`, `preparazione`, ecc.)
- Nessun `batchAIFilter` per ora — il filtro è solo hard filter su parole chiave
- Aggiunge `fetchArticleContent(url)`: prende l'articolo completo via HTTP per estrarre ingredienti e passaggi (input per il prompt ricetta)

### Feed di partenza
```js
const FEEDS = [
  'https://www.giallozafferano.it/feed',       // verificato ✅
  // 'https://www.foodmakers.it/feed',          // magazine: riattivare dopo 10 articoli corretti
];
```

> Obiettivo prima release: 10 articoli corretti da una fonte sola.  
> Foodmakers produce contenuti magazine (chef, interviste, trend) — pochi articoli passeranno `looksLikeRecipe`. Riattivare solo dopo aver verificato la qualità di Giallozafferano.

### Prompt Claude Code — STEP 1
```
Crea il file fetch-food.js nella root del progetto.

Il file deve esportare due funzioni: fetchFoodArticles() e fetchArticleContent(url).

fetchFoodArticles():
1. Legge i feed RSS dall'array FEEDS — per ora solo Giallozafferano:
   const FEEDS = ['https://www.giallozafferano.it/feed'];
2. Usa rss-parser (già installato) con Promise.allSettled — se un feed cade non blocca gli altri
3. Per ogni item del feed salva: title, link, pubDate
4. Genera uno slug dal titolo (stesso formato di run.js: lowercase, spazi → trattini,
   caratteri speciali rimossi, max 50 caratteri)
5. Applica un hard filter: l'item passa solo se il titolo contiene almeno una parola
   della WHITELIST food: ['ricetta', 'ingredienti', 'preparazione', 'pasta', 'risotto',
   'dolce', 'torta', 'zuppa', 'insalata', 'pollo', 'pesce', 'carne', 'verdura',
   'antipasto', 'primo', 'secondo', 'dessert']
6. Applica deduplicazione cross-run: leggi tutti i JSON in output/food/ (crea la directory
   se non esiste), estrai il campo "slug" da ciascuno, salta gli articoli il cui slug
   è già presente.
7. Per ogni articolo passato i filtri, chiama fetchArticleContent(link)
8. Restituisce array di oggetti { title, slug, link, pubDate, content }

fetchArticleContent(url):
- fa una GET HTTP con axios (già installato), headers User-Agent: 'Mozilla/5.0',
  timeout 8000ms, fallback '' se fallisce o se il sito risponde con status != 200
- pulisce l'HTML ricevuto con queste operazioni in sequenza:
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 12000)
- restituisce la stringa pulita

module.exports = { fetchFoodArticles, fetchArticleContent };

Non modificare fetch.js.
Crea anche output/food/.gitkeep per creare la directory nel repo.
```

### Test STEP 1
```bash
node -e "
const { fetchFoodArticles } = require('./fetch-food');
fetchFoodArticles().then(items => {
  console.log('Articoli trovati:', items.length);
  if (items[0]) {
    console.log('Titolo:', items[0].title);
    console.log('Slug:', items[0].slug);
    console.log('Content length:', items[0].content.length);
    console.log('Content preview:', items[0].content.slice(0, 200));
  }
});
"
```
**Atteso:** almeno 1 articolo con `title`, `slug`, `link`, `content` non vuoto e `content.length <= 12000`.

---

## STEP 2 — `generate-food.js`

### Cosa fa
Prende `{ title, content }` di un articolo food e genera le 5 slide in formato ricetta + `carousel_slides`.  
Riformatta la ricetta reale trovata nell'articolo — non inventa.

### Struttura 5 slide food

| Slide | Ruolo | Esempio |
|---|---|---|
| 1 | PIATTO — promessa visiva | "Una pasta cremosa senza panna" |
| 2 | INGREDIENTI — cosa serve | "Limone, burro, parmigiano e acqua di cottura" |
| 3 | PREPARAZIONE — il gesto chiave | "Cuoci la pasta molto al dente" |
| 4 | COTTURA / ASSEMBLAGGIO | "Manteca a fuoco spento con acqua di cottura" |
| 5 | TRUCCO FINALE — impiattamento | "Scorza di limone e pepe nero: non omettere" |

### Formato JSON output food
```json
{
  "agent": "food",
  "slug": "scaloppine-al-limone",
  "sourceId": "md5(link)",
  "dish_type": "meat",
  "signature_ingredients": ["limone", "burro", "prezzemolo"],
  "title": "Scaloppine al limone",
  "slides": ["...", "...", "...", "...", "..."],
  "carousel_slides": [
    { "layout_type": "hero",        "hook": "Scaloppine morbide al limone", "description": "Un secondo veloce, profumato e pronto in pochi passaggi.", "visual_hint": "piatto finale caldo", "image_query": "lemon veal scallopini", "icon": "tag" },
    { "layout_type": "right-focus", "hook": "...", "description": "...", "visual_hint": "...", "image_query": "...", "icon": "waves" },
    { "layout_type": "sensor-zoom", "hook": "...", "description": "...", "visual_hint": "...", "image_query": "...", "icon": "heart" },
    { "layout_type": "human-hand",  "hook": "...", "description": "...", "visual_hint": "...", "image_query": "...", "icon": "vibration" },
    { "layout_type": "cta-final",   "hook": "...", "description": "...", "visual_hint": "...", "image_query": "...", "icon": "check" }
  ],
  "link": "https://...",
  "pubDate": "...",
  "savedAt": "...",
  "image": "url og:image o Pexels"
}
```

> `carousel_slides` deve contenere **esattamente 5 oggetti** con `layout_type` fisso in ordine.  
> `dish_type`, `signature_ingredients`, `agent`, `slug`, `sourceId` sono obbligatori.  
> `signature_ingredients` sta a livello **root** dell'articolo — **non dentro** `carousel_slides[0]`.  
> `carousel_slides[0].description` è la micro-promessa del piatto, non la lista degli ingredienti firma.

### Hero slide — ingredienti firma e description

Per la slide 1, `signature_ingredients` e `description` hanno ruoli separati e non si duplicano.

| Campo | Contenuto | Esempio |
|---|---|---|
| `hook` | Titolo grande | "Scaloppine morbide al limone" |
| `signature_ingredients` | Max 3 ingredienti reali — riga sensoriale | `["limone", "burro", "prezzemolo"]` |
| `description` | Micro-promessa del piatto | "Un secondo veloce, profumato e pronto in pochi passaggi." |

Il frontend costruisce automaticamente la riga sensoriale da `article.signature_ingredients`:
```
limone · burro · prezzemolo
```

Rendering finale slide 1:
```
Scaloppine morbide al limone          ← hook
limone · burro · prezzemolo           ← da signature_ingredients (font piccolo, #e07b39)
Un secondo veloce, profumato...       ← description
```

**Regole:**
- `description` non deve contenere gli ingredienti firma — sono già in `signature_ingredients`
- `signature_ingredients` deve contenere solo ingredienti realmente presenti nel contenuto
- La lista operativa degli ingredienti resta nella Slide 2

### Prompt Claude Code — STEP 2
```
Crea il file generate-food.js nella root del progetto.

Prima di tutto, definisci internamente questa funzione di guardia:

function looksLikeRecipe(content = '') {
  const t = content.toLowerCase();
  const hasIngredients =
    /ingredienti|dosi per|per \d+ persone|persone|grammi|\d+\s?g\b|\d+\s?ml|cucchiai|qb|q\.b\.|farina|zucchero|olio|sale|burro|uova/i.test(t);
  const hasProcedure =
    /preparazione|procedimento|preparate|cuocete|cuoci|tagliate|mescolate|versate|aggiungete|unite|infornate|servite/i.test(t);
  return content.length >= 800 && hasIngredients && hasProcedure;
}

Il file deve esportare due funzioni:

1. generateRecipeSlides(title, content)
   - Se !looksLikeRecipe(content): return null immediatamente, senza chiamare DeepSeek.
     Logga: "SKIP [title]: non sembra una ricetta (length: N)"
   - Calcola hash: const hash = md5(normalize(title))
   - Controlla cache con chiave: `food:slides:${hash}`
     (NON usare md5 sull'intera stringa "food:slides:title" — la chiave deve iniziare
     con "food:slides:" per poter essere cancellata con startsWith nel backfill)
   - Se non in cache, chiama callDeepSeek da deepseek.js (non modificare)
   - Il prompt spiega che content è il testo estratto da un articolo food reale
   - Chiede di estrarre/riformattare la ricetta reale in 5 slide con ruoli fissi:
     Slide 1 = PIATTO (promessa visiva del risultato finale, max 8 parole)
     Slide 2 = INGREDIENTI (se gli ingredienti sono molti, scegli solo i 4-5 essenziali,
               max 8 parole totali)
     Slide 3 = PREPARAZIONE (il gesto chiave della preparazione, max 8 parole)
     Slide 4 = COTTURA (assemblaggio o cottura, max 8 parole)
     Slide 5 = TRUCCO (trucco finale o impiattamento, max 8 parole)
   - Risponde SOLO con JSON: { "slides": ["...", "...", "...", "...", "..."] }
   - NON inventare ingredienti, dosi o passaggi non presenti nel testo
   - Validazione: array di esattamente 5 stringhe, ognuna max 10 parole
   - Retry 1x se JSON non valido, poi restituisce null
   - Se valido, salva in cache con chiave `food:slides:${hash}`

2. generateRecipeCarouselSlides(title, slides)
   - Calcola hash: const hash = md5(normalize(title))
   - Controlla cache con chiave: `food:carousel:${hash}`
   - Il prompt deve dedurre anche:
     dish_type: uno tra "pasta", "meat", "fish", "soup", "dessert", "salad", "vegetable", "generic"
     signature_ingredients: array di massimo 3 ingredienti realmente presenti nella ricetta
     (NON forzare mai "pasta" se il piatto non è pasta)
   - image_query deve rappresentare il piatto reale, non il template. Esempi per dish_type:
     pasta al limone     → "lemon pasta"
     scaloppine          → "lemon veal scallopini"
     pollo al forno      → "roasted chicken herbs"
     salmone in padella  → "pan seared salmon"
     vellutata di zucca  → "pumpkin soup bowl"
     torta al cioccolato → "chocolate cake slice"
     insalata greca      → "greek salad bowl"
   - carousel_slides[0] è la HERO slide:
     - hook = titolo grande del piatto + promessa visiva
     - description = micro-promessa del piatto (NON gli ingredienti firma — quelli
       stanno in signature_ingredients a livello root, non qui)
     - visual_hint = piatto finale
   - carousel_slides[1] è la slide INGREDIENTI:
     - hook = ingredienti essenziali
     - description = solo 4-5 ingredienti principali, no lista completa
   - carousel_slides[2] è la slide PREPARAZIONE: gesto chiave
   - carousel_slides[3] è la slide COTTURA / ASSEMBLAGGIO
   - carousel_slides[4] è la slide TRUCCO FINALE: dettaglio finale, servizio, impiattamento
   - layout_type segue la sequenza fissa:
     hero → right-focus → sensor-zoom → human-hand → cta-final
   - Risponde SOLO con JSON:
     {
       "dish_type": "...",
       "signature_ingredients": ["...", "...", "..."],
       "carousel_slides": [...]
     }
     IMPORTANTE: signature_ingredients è a livello ROOT della risposta,
     NON dentro carousel_slides[0]. Il frontend lo legge da article.signature_ingredients.
   - Validazione:
     dish_type deve essere uno tra: pasta, meat, fish, soup, dessert, salad, vegetable, generic
     signature_ingredients deve essere array con massimo 3 stringhe, solo ingredienti reali
     carousel_slides deve essere array di esattamente 5 elementi
     ogni elemento deve avere: hook, description, visual_hint, image_query, layout_type, icon
     carousel_slides[0].description NON deve essere la lista degli ingredienti firma
   - Se valido, salva in cache con chiave `food:carousel:${hash}`

Non modificare generate.js né deepseek.js.
```

### Test STEP 2
```bash
node -e "
const { generateRecipeSlides, generateRecipeCarouselSlides } = require('./generate-food');

const content = \`
Ingredienti per 4 persone: 320g spaghetti, 2 limoni, 80g burro,
100g parmigiano, sale, pepe, acqua di cottura q.b.

Preparazione: cuocete la pasta molto al dente in acqua salata.
Grattugiate la scorza dei limoni e spremete il succo. In una padella
sciogliete il burro a fuoco basso, aggiungete il succo di limone e
un mestolo di acqua di cottura. Versate la pasta nella padella e
mescolate energicamente. Aggiungete il parmigiano poco alla volta,
mantecando fino a ottenere una crema. Servite con scorza di limone
e pepe nero.
\`.repeat(4);

generateRecipeSlides('Pasta al limone cremosa', content).then(async slides => {
  console.log('Slides:', slides);
  console.log('looksLikeRecipe ok:', slides !== null);

  if (slides) {
    const result = await generateRecipeCarouselSlides('Pasta al limone cremosa', slides);
    console.log('dish_type:', result?.dish_type);
    console.log('signature_ingredients:', result?.signature_ingredients);
    console.log('carousel_slides count:', result?.carousel_slides?.length);
    console.log('hero description:', result?.carousel_slides?.[0]?.description);

    // Validazioni
    const validDishTypes = ['pasta','meat','fish','soup','dessert','salad','vegetable','generic'];
    console.log('dish_type valido:', validDishTypes.includes(result?.dish_type));
    console.log('signature_ingredients <= 3:', (result?.signature_ingredients?.length || 0) <= 3);
    console.log('carousel completo:', result?.carousel_slides?.length === 5);
  }
});
"
```
**Atteso:** 5 slides, `dish_type` valido, `signature_ingredients` max 3 elementi reali, `carousel_slides.length === 5`, `hero.description` senza lista ingredienti.

---

## STEP 3 — `run-food.js`

### Cosa fa
Pipeline completa del food agent. Equivalente di `run.js` ma per food.  
Salva JSON in `output/food/` e scrive `frontend/data-food.js`.

### Flusso
```
node run-food.js
  └── fetchFoodArticles()          ← fetch-food.js
        └── generateRecipeSlides() ← generate-food.js
              └── generateRecipeCarouselSlides()
                    └── fetchPexelsImage()   ← fetch.js (riutilizzata, non modificata)
                          └── salva output/food/timestamp_slug.json
                                └── scrive frontend/data-food.js
```

### Prompt Claude Code — STEP 3
```
Crea il file run-food.js nella root del progetto.

Il file deve orchestrare la pipeline food completa.

IMPORTANTE — robustezza (regola 1: non rompere mai AI news):
- Avvolgi l'intero main in try/catch esterno: cattura errori strutturali
  (file system, cache.json corrotto, output/food/ non creabile) e logga senza process.exit(1).
- Nel loop per ogni articolo, usa try/catch interno separato: un errore su un singolo
  articolo non deve interrompere il loop né impedire la scrittura finale di data-food.js.
- run-food.js non deve mai usare process.exit(1) per errori recuperabili.
- Scrivi SEMPRE frontend/data-food.js alla fine, anche se nessun articolo è stato generato:
  in quel caso scrivi: window.FOOD_ARTICLES = [];

Pipeline:

0. Leggi la variabile d'ambiente:
   const MAX_NEW = Number(process.env.MAX_NEW_FOOD_ARTICLES || 1);
   (Default 1 per il primo test; aumentare a 3 solo dopo verifica.)

1. Chiama fetchFoodArticles() da fetch-food.js
2. Prendi solo i primi MAX_NEW articoli dell'array restituito
3. Per ogni articolo (try/catch interno):
   a. Chiama generateRecipeSlides(title, content) da generate-food.js
   b. Se slides è null → logga "SKIP [titolo]: non è una ricetta", continua
   c. Chiama generateRecipeCarouselSlides(title, slides) da generate-food.js
      La funzione restituisce { dish_type, signature_ingredients, carousel_slides }
      Destruttura: const { dish_type, signature_ingredients, carousel_slides } = result || {}
   d. Se carousel_slides è null o carousel_slides.length !== 5 →
      logga "SKIP [titolo]: carousel incompleto", continua
   e. Per slide 1: prova fetchArticleImage(link) da fetch.js per og:image.
      Se l'URL restituito contiene "logo", "placeholder", "default", "avatar" → scarta.
      Se null o scartato, usa fallback: fetchPexelsImage(carousel_slides[0].image_query)
   f. Per slide 2-5: chiama fetchPexelsImage(carousel_slides[i].image_query) da fetch.js
   g. Costruisce oggetto articolo:
      {
        agent: "food",
        slug,
        sourceId: md5(link),
        dish_type,
        signature_ingredients,
        title,
        slides,
        carousel_slides,
        link,
        pubDate,
        savedAt: new Date().toISOString(),
        image
      }
      NOTA: signature_ingredients è a livello root dell'articolo — non dentro carousel_slides.
   h. Salva in output/food/TIMESTAMP_slug.json

4. Dopo il loop (anche se 0 articoli generati), costruisce frontend/data-food.js:
   - Legge TUTTI i file in output/food/
   - Deduplica per slug (.sort().reverse() poi controlla slug già visti)
   - Ordina per savedAt decrescente
   - Scrive: window.FOOD_ARTICLES = [...];
     Se array vuoto scrive: window.FOOD_ARTICLES = [];
   ATTENZIONE: scrive data-food.js, NON data.js. Non toccare data.js.

5. Log finale: "Food agent completato. Nuovi articoli: N. Totale: M."

Non modificare run.js, fetch.js né nessun altro file esistente.
Importa fetchPexelsImage e fetchArticleImage da fetch.js (sono già esportate).
Non usare né rimuovere GENERATE_FORMATS — quella variabile riguarda run.js, non questo file.
```

### Test STEP 3
```bash
# Primo run — solo 1 articolo per verificare che tutto funzioni
MAX_NEW_FOOD_ARTICLES=1 node run-food.js

# Verifica output
ls output/food/
cat output/food/$(ls -t output/food/ | head -1) | node -e "
const d = require('fs').readFileSync('/dev/stdin','utf8');
const a = JSON.parse(d);
console.log('agent:', a.agent);
console.log('slug:', a.slug);
console.log('sourceId:', a.sourceId ? 'presente' : 'ASSENTE ⚠️');
console.log('dish_type:', a.dish_type || 'ASSENTE ⚠️');
console.log('signature_ingredients:', a.signature_ingredients || 'ASSENTE ⚠️');
console.log('slides count:', a.slides?.length);
console.log('carousel_slides count:', a.carousel_slides?.length);
console.log('hero description:', a.carousel_slides?.[0]?.description);
console.log('image slide 1:', a.image ? 'presente' : 'ASSENTE ⚠️');
"

# Verifica data-food.js (deve esistere anche se vuoto)
head -3 frontend/data-food.js

# Se il primo articolo è OK, scala a 3
MAX_NEW_FOOD_ARTICLES=3 node run-food.js
```
**Atteso:** JSON con `agent`, `slug`, `sourceId`, `dish_type` valido, `signature_ingredients` max 3 elementi, 5 slides, `carousel_slides.length === 5`, `image` presente. `signature_ingredients` a root — non dentro `carousel_slides[0]`.

---

## STEP 4 — `frontend/carousel-food.html`

### Cosa fa
Pagina carousel per il food agent. Identica a `carousel.html` ma legge `data-food.js`  
e ha branding e identità visiva food-native.

> **Template visivo di riferimento:**  
> `\\wsl$\Ubuntu\home\miki\visual-scroll-blog\foodagent-slideshow.png`  
> Aprire prima di implementare — contiene l'esempio completo delle 5 slide (scaloppine al limone)  
> con layout, colori, tipografia, posizione ingredienti firma e stile decorativi attesi.

### Differenze da `carousel.html`

| Elemento | carousel.html | carousel-food.html |
|---|---|---|
| Data source | `data.js` → `window.ARTICLES` | `data-food.js` → `window.FOOD_ARTICLES` |
| Badge slide 1 | `AI NEWS` | `5 STEP FOOD` |
| Handle | `@FlashAI` | `@FlashKitchen` (o scegliere) |
| Colore accent | slate/blu | verde oliva / arancio food |
| Fallback immagini | dark tech blu/viola, orb, linee glow | dark warm food, oliva/arancio, forme circolari |

### Fallback immagini — note di architettura

`carousel-food.html` è una pagina dedicata solo al food agent. Il fallback quando manca un'immagine deve essere sempre food-themed — non il dark tech di `carousel.html`.

**Non aggiungere logica multi-agente** tipo `getFallbackBackground(article, slideIndex)` con controlli su `article.agent`: questa pagina serve un solo agente, il condizionale è superfluo e anticipa una complessità che non esiste ancora.

La logica condizionale per agente (`getFallbackBackground(agent, slideIndex)`) verrà introdotta solo in futuro, quando esisterà un template condiviso o il dropdown multi-agente in `index.html`.

**Palette fallback food:**
```
Sfondo base:     #10150f / #14110d
Verde oliva:     #3d5a3e
Arancio caldo:   #e07b39
Crema testo:     #f7efe3
Accento chiaro:  #f2b36d
```

**Gradiente CSS fallback food:**
```css
background:
  radial-gradient(circle at 80% 20%, rgba(224, 123, 57, 0.35), transparent 35%),
  radial-gradient(circle at 20% 80%, rgba(61, 90, 62, 0.55), transparent 40%),
  linear-gradient(135deg, #10150f 0%, #1d2a1d 45%, #2a180f 100%);
```

**Elementi decorativi per slide:**
| Slide | Decorativo |
|---|---|
| 1 | Cerchio grande tipo piatto — promessa visiva |
| 2 | Dot piccoli tipo spezie / ingredienti sparsi |
| 3 | Linee movimento tipo mescolare / impasto |
| 4 | Onde calore / cottura |
| 5 | Glow caldo finale / impiattamento |

### Prompt Claude Code — STEP 4
```
Prima di scrivere qualsiasi codice, apri e osserva il template visivo di riferimento:
\\wsl$\Ubuntu\home\miki\visual-scroll-blog\foodagent-slideshow.png

Questo file mostra l'esempio completo delle 5 slide food (scaloppine al limone):
layout, colori, posizione degli elementi, riga ingredienti firma, stile decorativi.
Usa questo template come guida visiva per tutto quello che segue.

Crea frontend/carousel-food.html copiando carousel.html e applicando queste modifiche:

1. Cambia <script src="data.js"> in <script src="data-food.js">
2. Cambia tutti i riferimenti a window.ARTICLES in window.FOOD_ARTICLES
3. Nel badge della slide 1 (cerca il testo "AI NEWS") cambia in "5 STEP FOOD"
4. Nell'handle (cerca "@FlashAI") cambia in "@FlashKitchen"
5. Cambia il colore accent principale (il blu/slate) in verde oliva scuro: #3d5a3e
   e il colore secondario in arancio caldo: #e07b39
6. Aggiorna il <title> della pagina in "Carousel Food — 5 Step Food"
7. Se window.FOOD_ARTICLES è assente o ha length === 0, mostra uno stato vuoto leggibile:
   <div id="empty-state">
     Nessun articolo food generato ancora.<br>
     Esegui: node run-food.js
   </div>
   Non lasciare pagina bianca o errori JS visibili.

8. Fallback immagini food:
   Se una slide non ha immagine, NON usare il fallback dark tech blu/viola di carousel.html.
   Sostituisci il fallback con uno a tema food:
   - Gradiente base:
     radial-gradient(circle at 80% 20%, rgba(224,123,57,0.35), transparent 35%),
     radial-gradient(circle at 20% 80%, rgba(61,90,62,0.55), transparent 40%),
     linear-gradient(135deg, #10150f 0%, #1d2a1d 45%, #2a180f 100%)
   - Aggiungi elementi decorativi SVG leggeri per slide:
     Slide 1 → cerchio grande tipo piatto
     Slide 2 → dot piccoli tipo spezie sparsi
     Slide 3 → linee curve tipo mescolare
     Slide 4 → onde tipo calore/vapore
     Slide 5 → glow caldo tipo impiattamento
   - Testo su fallback: colore crema #f7efe3

9. Rendering signature_ingredients nella slide 1:
   Se article.signature_ingredients esiste e contiene elementi, renderizza una riga
   sensoriale nella hero slide con questa struttura e posizione precise:
   - Posizione: sotto l'hook (titolo grande), sopra la description (micro-promessa)
   - Contenuto: ingredienti separati da " · " (spazio · spazio)
   - Classe CSS dedicata: .signature-ingredients
   - Stile: font piccolo/medio, elegante, non dominante
   - Colore: #e07b39 (arancio caldo)
   - Costruzione: article.signature_ingredients.join(' · ')

   Rendering finale slide 1:
   [hook]                   ← titolo grande
   [signature_ingredients]  ← riga arancio, font piccolo (es. "limone · burro · prezzemolo")
   [description]            ← micro-promessa (es. "Un secondo veloce, profumato...")

   NON duplicare gli ingredienti: se signature_ingredients è presente,
   non inserire anche la lista dentro description.
   NON leggere da carousel_slides[0]: leggi sempre da article.signature_ingredients (root).

Non modificare carousel.html.
```

### Test STEP 4
```bash
open frontend/carousel-food.html   # macOS
xdg-open frontend/carousel-food.html   # Linux
```
**Atteso:**
- pagina carousel con articoli food, badge "5 STEP FOOD", colori food
- slide 1: riga arancio `limone · burro · prezzemolo` tra titolo e description
- `.signature-ingredients` visibile, colore `#e07b39`, font leggero
- se `data-food.js` è vuoto: messaggio "Nessun articolo food generato ancora."
- testa download PNG: almeno una slide scaricabile a 1080×1350px con riga ingredienti visibile

---

## STEP 5 — Automazione GitHub Actions

### Cosa fa
Aggiunge `run-food.js` al workflow CI/CD esistente, sequenziale dopo `run.js`.

### Prompt Claude Code — STEP 5
```
Modifica .github/workflows/pipeline.yml per aggiungere l'esecuzione di run-food.js.

Dopo il passo che esegue run.js (cerca "node run.js" nel file), aggiungi un passo separato:

- name: Esegui pipeline food
  run: node run-food.js || echo "⚠️ Food pipeline failed, continuing"
  env:
    DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
    PEXELS_API_KEY: ${{ secrets.PEXELS_API_KEY }}
    MAX_NEW_FOOD_ARTICLES: '3'

IMPORTANTE:
- Il passo food è NON-BLOCCANTE nella prima release (|| echo).
  Se fallisce, AI news deve comunque completare commit/push/deploy.
  Quando il food agent genera 10 articoli corretti senza errori, rimuovi || echo.
- I due passi devono restare SEQUENZIALI nello stesso job, mai in job paralleli.
  Entrambi usano cache.json — parallelizzarli causerebbe write conflict silenzioso.
- NON rimuovere né modificare GENERATE_FORMATS dal passo AI news esistente.
- Assicurati che il passo git commit/push finale includa output/food/ e frontend/data-food.js.
  Se il passo di commit usa "git add ." va già bene.
  Se usa path espliciti, aggiungi: output/food/ e frontend/data-food.js.

Non modificare nient'altro nel file.
```

### Test STEP 5
Trigger manuale su GitHub Actions → verifica che:
- il passo AI news completi verde
- il passo food completi (verde o con warning `⚠️ Food pipeline failed, continuing`)
- il commit finale includa `output/food/` e `frontend/data-food.js`

> ⚠️ **Attenzione al falso verde:** grazie a `|| echo`, il passo food risulta sempre verde in Actions anche quando fallisce. Controllare sempre il log del passo food cercando la stringa `"Food pipeline failed, continuing"`. Se compare, il food non ha prodotto output valido nonostante il check verde.

Se il passo food fallisce in CI ma passa in locale: verifica `PEXELS_API_KEY` nei GitHub Secrets (vedi MANUAL.md §17 — stesso bug già risolto per AI news).

## STEP 6 — Dropdown multi-agente in `index.html`

### Cosa fa
Aggiunge una tendina in cima al feed che permette di passare da "AI News" a "5 Step Food"  
senza ricaricare la pagina. Al cambio, carica dinamicamente `data-food.js` via fetch  
e rimpiazza gli articoli visualizzati.

### Comportamento
- Default: mostra AI News (come oggi — zero regressioni)
- Selezione "5 Step Food": carica `data-food.js` in fetch dinamico, rimpiazza il feed
- Selezione "AI News": ripristina `window.ARTICLES` originale
- Lo stato del dropdown non persiste al refresh (semplice, no localStorage)
- Il cambio agente porta sempre alla prima slide del primo articolo

### Strategia fetch dinamico
`data-food.js` espone `window.FOOD_ARTICLES`. Il fetch lo carica come script  
solo la prima volta (poi è già in memoria). Il feed si svuota e si ripopola  
con il nuovo array senza ricaricare la pagina.

### Prompt Claude Code — STEP 6
```
Modifica frontend/index.html aggiungendo il dropdown multi-agente.
ATTENZIONE: non modificare nulla della logica di scroll, touch, IntersectionObserver
o rendering delle slide — solo aggiungere il dropdown e la sua logica.

1. DROPDOWN HTML
   Aggiungi in cima alla pagina (prima del .feed o dentro una navbar fissa in alto):
   <div id="agent-bar">
     <select id="agent-select">
       <option value="ai-news">⚡ AI News</option>
       <option value="food">🍳 5 Step Food</option>
     </select>
   </div>

   CSS per #agent-bar: posizione fixed in alto, z-index alto, background scuro,
   padding minimo. Il select deve essere visibile su mobile.
   Assicurati che il .feed abbia padding-top sufficiente per non finire sotto la barra.

2. LOGICA JS
   Aggiungi questa logica (non toccare il codice esistente):

   const originalArticles = window.ARTICLES.slice(); // copia degli articoli AI news
   let foodLoaded = false;

   document.getElementById('agent-select').addEventListener('change', async function() {
     const val = this.value;
     if (val === 'food') {
       if (!foodLoaded) {
         // carica data-food.js dinamicamente come script
         await new Promise((resolve, reject) => {
           const s = document.createElement('script');
           s.src = 'data-food.js';
           s.onload = resolve;
           s.onerror = reject;
           document.head.appendChild(s);
         });
         foodLoaded = true;
       }
       renderFeed(window.FOOD_ARTICLES);
     } else {
       renderFeed(originalArticles);
     }
   });

   // renderFeed(articles) deve: svuotare il .feed, ricostruire gli articoli
   // con la stessa logica già esistente nel codice di renderizzazione,
   // poi portare lo scroll a top.
   // IMPORTANTE: estrai la logica di rendering esistente in una funzione renderFeed()
   // richiamabile — non duplicare il codice, refactorizza.

3. Verifica che i 7 scenari test M15 (MANUAL.md §12) continuino a passare
   dopo il refactor di renderFeed().
```

### Test STEP 6

**Test dropdown:**
| # | Azione | Atteso |
|---|---|---|
| 1 | Carica la pagina | Mostra AI News, dropdown su "AI News" |
| 2 | Seleziona "5 Step Food" | Feed cambia, mostra ricette food |
| 3 | Seleziona di nuovo "AI News" | Feed torna alle notizie AI |
| 4 | Cambia agente a metà scroll | Torna alla prima slide del primo articolo |
| 5 | Seleziona Food due volte | Secondo caricamento non fa double fetch |

**Test regressione M15** (vedi MANUAL.md §12 — i 7 scenari devono passare su entrambi gli agenti):
- Eseguire tutti i 7 scenari su AI News dopo il refactor
- Eseguire gli stessi 7 scenari su 5 Step Food

---

## STEP 7 — Navigazione multi-pagina e agent switch su tutte le pagine

### Cosa fa
Collega le quattro pagine frontend con una navigazione coerente e aggiunge il controllo agente
(AI News / 5 Step Food) su ogni pagina, in modo che l'utente non debba ricordare gli URL.

### Comportamento per pagina

| Pagina | Agent switch | Tipo switch | Nav links |
|---|---|---|---|
| `index.html` | ⚡ AI News / 🍳 5 Step Food | in-page (renderFeed) | Review, Carousel |
| `review.html` | ⚡ AI News / 🍳 5 Step Food | in-page (renderReview) | ← Feed, Carousel AI, Carousel Food |
| `carousel.html` | ⚡ AI News / 🍳 5 Step Food | navigazione (→ carousel-food.html) | ← Feed, Review, Carousel Food |
| `carousel-food.html` | ⚡ AI News / 🍳 5 Step Food | navigazione (→ carousel.html) | ← Feed, Review, Carousel AI |

### Dettaglio implementazione

**`index.html`** — nav links nella agent-bar (a destra, position:absolute):
```html
<nav id="agent-nav">
  <a href="review.html">Review</a>
  <a href="carousel.html">Carousel</a>
</nav>
```

**`review.html`** — header sticky refactor completo:
- Header `<div class="review-header">` sticky top:0 z-index:10
- Select `.review-agent-sel` con caricamento dinamico di `data-food.js` (stessa logica di index.html)
- Titolo h1 aggiornato dinamicamente: "Review articoli" → "Review ricette" in modalità food
- `renderReview(articles)` sostituisce il rendering inline precedente
- Il contatore articoli funziona su entrambi gli agenti

**`carousel.html` e `carousel-food.html`** — select navigazione:
```html
<!-- in carousel.html -->
<select class="header-agent-sel" onchange="if(this.value!=='ai-news') window.location.href=this.value">
  <option value="ai-news">⚡ AI News</option>
  <option value="carousel-food.html">🍳 5 Step Food</option>
</select>

<!-- in carousel-food.html -->
<select class="header-agent-sel" onchange="if(this.value!=='food') window.location.href=this.value">
  <option value="carousel.html">⚡ AI News</option>
  <option value="food" selected>🍳 5 Step Food</option>
</select>
```
Le pagine carousel usano navigazione (non in-page) perché le due versioni hanno design diversi
(palette blu tech vs palette olive/arancio food) — non è sensato far convivere i due CSS in una pagina.

---

## STEP 8 — Palette food nel feed

### Cosa fa
Quando `renderFeed` mostra articoli food, le story usano la palette food
(gradienti olive/arancio) invece del blu scuro dell'AI news.

### Approccio
Classe CSS `.food-story` aggiunta dinamicamente a ogni `.story` quando `isFood === true`.  
Il CSS `.food-story` sovrascrive tutti i colori dipendenti dall'agente senza toccare
le regole base dell'AI news.

### Colori applicati

| Elemento | AI News | 5 Step Food |
|---|---|---|
| Slide background | `#000` | `#10150f` |
| slide-color-0 gradient | dark blue `#09122a→#0e1d4a` | olive/arancio hero |
| slide-color-1 gradient | dark navy | right-focus warm |
| slide-color-2 gradient | dark indigo | sensor-zoom green |
| slide-color-3 gradient | dark violet | human-hand amber |
| slide-color-4 gradient | dark blue | cta-final warm glow |
| cf-overlay (fallback) | stesso blue per layout | gradiente food per layout |
| cf-accent (hook split) | `#60a5fa` (blue) | `#f2b36d` (gold caldo) |
| cf-footer | `@FlashAI` | `@FlashKitchen` |
| slide-badge | `#2563eb` (blue) | `#3d5a3e` (olive) |
| badge-line | `rgba(37,99,235,0.7)` | `rgba(61,90,62,0.7)` |
| dot.active | `#3b82f6` (blue) | `#e07b39` (arancio) |
| slide-info bg | `#0a0a0a` | `#0c100b` |

### Gradienti food per layout (da carousel-food.html)
```css
.food-story .slide-color-0 .slide-visual { background:
  radial-gradient(circle at 80% 20%, rgba(224,123,57,.35), transparent 35%),
  radial-gradient(circle at 20% 80%, rgba(61,90,62,.55), transparent 40%),
  linear-gradient(135deg, #10150f 0%, #1d2a1d 45%, #2a180f 100%); }

.food-story .slide-color-1 .slide-visual { background:
  radial-gradient(circle at 75% 30%, rgba(224,123,57,.25), transparent 40%),
  linear-gradient(148deg, #12100c 0%, #1a2410 60%, #201208 100%); }

.food-story .slide-color-2 .slide-visual { background:
  radial-gradient(circle at 50% 70%, rgba(61,90,62,.50), transparent 45%),
  linear-gradient(138deg, #0f1209 0%, #182014 60%, #1a1208 100%); }

.food-story .slide-color-3 .slide-visual { background:
  radial-gradient(circle at 20% 80%, rgba(224,123,57,.30), transparent 40%),
  linear-gradient(152deg, #14110d 0%, #1e1a0e 60%, #241505 100%); }

.food-story .slide-color-4 .slide-visual { background:
  radial-gradient(circle at 50% 50%, rgba(224,123,57,.40), transparent 50%),
  linear-gradient(148deg, #10150f 0%, #1c2410 60%, #2a1a08 100%); }
```
Gli stessi gradienti sono applicati ai `.cf-wrap.{layout}  .cf-overlay` per il fallback senza immagine.

### Modifica buildCarouselFallback
```js
// Prima: buildCarouselFallback(cs)
// Dopo:  buildCarouselFallback(cs, isFood)
// Chiamata: visual.appendChild(buildCarouselFallback(article.carousel_slides[i], isFood));
// Footer:   isFood ? '@FlashKitchen' : '@FlashAI'
```

---

## Note operative

### Variabili d'ambiente
Nessuna variabile nuova necessaria — `run-food.js` usa le stesse chiavi già configurate:

| Variabile | Dove serve |
|---|---|
| `DEEPSEEK_API_KEY` | `.env` locale + GitHub Secrets + Railway |
| `PEXELS_API_KEY` | `.env` locale + GitHub Secrets + Railway |

> Vedi MANUAL.md §17 per la procedura di configurazione.

### Cache
`run-food.js` usa la stessa `cache.json` con due chiavi prefissate leggibili:
```js
const hash = md5(normalize(title));
const slidesKey   = `food:slides:${hash}`;    // es. "food:slides:a7f91c2e..."
const carouselKey = `food:carousel:${hash}`;  // es. "food:carousel:a7f91c2e..."
```

Il prefisso `food:slides:` e `food:carousel:` è nella chiave stessa — non nell'hash — così il backfill con `startsWith` funziona correttamente. Non usare `md5('food:slides:' + title)` che produrrebbe una chiave opaca senza prefisso leggibile.

> ⚠️ **`run.js` e `run-food.js` devono restare sequenziali** nello stesso job GitHub Actions.  
> Entrambi leggono e scrivono `cache.json` — metterli in job paralleli causerebbe write conflict silenzioso. Non parallelizzare finché non esiste una cache separata o un lock file.

### Directory output
`output/food/` è separata da `output/`. Verifica che `.railwayignore` escluda entrambe — aggiungilo esplicitamente per evitare ambiguità:

```
output/
output/food/
```

### Backfill food
Se in futuro serve rigenerare le slide food (es. dopo un cambio di prompt):
```bash
# svuota cache food (slides + carousel)
node -e "
const fs = require('fs');
const cache = JSON.parse(fs.readFileSync('cache.json','utf8'));
const filtered = Object.fromEntries(
  Object.entries(cache).filter(([k]) => !k.startsWith('food:slides:') && !k.startsWith('food:carousel:'))
);
fs.writeFileSync('cache.json', JSON.stringify(filtered, null, 2));
console.log('Cache food rimossa.');
"
# rigenera
node run-food.js
```

### Errori comuni food agent

| Errore | Causa | Soluzione |
|---|---|---|
| `content` vuoto o length < 100 su tutti gli articoli | Giallozafferano blocca scraping con User-Agent generico | Prova User-Agent più specifico: `'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'` + header `Accept-Language: it-IT` |
| Tutti gli articoli skippati per "non sembra una ricetta" | Feed Giallozafferano contiene articoli magazine, non ricette | Verificare il tipo di articoli nel feed; aggiungere feed più specifici per ricette |
| Slide food con parole AI o informatiche | Prompt non abbastanza diretto | Aggiungere nel prompt: "NON usare termini tecnici informatici. Parla solo di cucina." |
| `data-food.js` non aggiornato in CI | Path non incluso nel git add | Verificare il passo commit in `pipeline.yml` — aggiungere `frontend/data-food.js` |
| `image` assente su slide 1 | `fetchArticleImage` null + fallback Pexels fallito | Controllare che `carousel_slides[0].image_query` sia presente e sensato |
| Carousel food mostra articoli AI | `window.FOOD_ARTICLES` non trovato | Verificare che `data-food.js` sia caricato correttamente |

---

## Roadmap futura

Questi step non sono implementati ora ma seguono la stessa struttura:

- Agente fitness, travel, finance con struttura analoga al food agent
- Refactor in `agents/` quando ci sono 3+ agenti stabili (vedi PROJECT.md FASE 5)
- Auto-pubblicazione carousel food su Instagram (PROJECT.md FASE 6)
- **Template condiviso multi-agente:** quando esisterà un renderer unico per più agenti,
  introdurre `getFallbackBackground(agent, slideIndex)` con fallback tematici per agente.
  Solo in quel momento ha senso spostare il condizionale su `article.agent` in un file separato.

> `review-food.html` non è più necessario: `review.html` gestisce entrambi gli agenti
> tramite il select agente e `renderReview(articles)` introdotto in STEP 7.
