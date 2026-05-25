'use strict';

require('dotenv').config();
const path = require('path');

const args    = process.argv.slice(2);
const tmplArg = args[args.indexOf('--template') + 1];
if (!tmplArg) {
  console.error('Uso: node video/test-template.js --template <nome>');
  process.exit(1);
}

const template    = require('./templates')[tmplArg];
const agentConfig = require('../agents')['ai-news'];

if (!template) {
  console.error('Template non trovato:', tmplArg);
  console.error('Disponibili:', Object.keys(require('./templates')).join(', '));
  process.exit(1);
}

const outputPath = path.resolve(`output/renders/test-${tmplArg}.mp4`);
console.log(`\n🧪 Test template: ${tmplArg}`);
console.log(`   Output: ${outputPath}\n`);

// ─── Fake articles ────────────────────────────────────────────────────────────

const FAKE_ARTICLES = {};

FAKE_ARTICLES['data_story'] = {
  slug:         'test-data-story',
  title:        'AI Chip Market Grows 45% — Who Is Winning?',
  video_script: [
    'The AI chip market just grew forty-five percent in one year.',
    'OpenAI is valued at eighty billion. Google DeepMind at fifty.',
    'Enterprise AI adoption has now reached sixty-three percent.',
    'The adoption curve accelerates every single quarter.',
    'Companies that wait lose ground permanently.',
  ],
};

FAKE_ARTICLES['kinetic_typography'] = {
  slug:         'test-kinetic',
  title:        'GPT-5 Can Now Reason Like a Human Expert',
  video_script: [
    'GPT-5 passes the bar exam in the top ten percent.',
    'It reasons across multiple steps without losing context.',
    'Errors dropped sixty percent compared to GPT-4.',
    'Lawyers, doctors, and engineers are already using it daily.',
    'The question is not if AI replaces experts. It is when.',
  ],
};

FAKE_ARTICLES['slide_deck'] = {
  slug:         'test-slide-deck',
  title:        'OpenAI Releases GPT-5 With Reasoning Mode',
  video_script: [
    'GPT-5 is here and it changes everything.',
    'It can reason step by step like a human expert.',
    'Benchmarks show sixty percent fewer errors than GPT-4.',
    'Available today on ChatGPT Plus for all subscribers.',
    'The AI race just entered a completely new phase.',
  ],
};

FAKE_ARTICLES['network_graph'] = {
  slug:         'test-network-graph',
  title:        'Multi-Agent AI Systems: How Autonomous Agents Collaborate',
  video_script: [
    'Multi-agent systems are reshaping how AI solves complex problems.',
    'Each agent specializes in one task and passes results to the next.',
    'Orchestrators coordinate tools, memory, and decision making.',
    'The whole system is greater than the sum of its parts.',
    'This is the architecture powering the next generation of AI.',
  ],
};

FAKE_ARTICLES['timeline_motion'] = {
  slug:         'test-timeline-motion',
  title:        'From GPT-1 to GPT-5: The Evolution of AI Language Models',
  video_script: [
    'GPT-1 launched in 2018 with 117 million parameters.',
    'GPT-3 shocked the world with 175 billion parameters.',
    'ChatGPT reached 100 million users in just 5 days.',
    'GPT-4 passed the bar exam in the top 10 percent.',
    'GPT-5 can now reason like a human expert.',
  ],
};

FAKE_ARTICLES['whiteboard'] = {
  slug:         'test-whiteboard',
  title:        'How Large Language Models Actually Work: Attention, Input, Output',
  video_script: [
    'A large language model takes text as input, applies attention, and generates output.',
    'Training transforms raw data into a model that understands context.',
    'The agent observe-decide-act cycle is the foundation of autonomous AI.',
    'Three steps are all you need to solve most AI problems.',
    'Connect specialized agents together and they outperform any single model.',
  ],
};

FAKE_ARTICLES['code_terminal'] = {
  slug:         'test-code-terminal',
  title:        'Three Lines of Code: How AI Agents Read the Entire Web for You',
  video_script: [
    'Three lines of code and an AI agent reads the web for you.',
    'No manual work. No curation. Just a script that runs every two hours.',
    'The filter is AI-powered: only the best articles get through.',
    'One push to Git. Railway deploys in under a minute.',
    'The future of content automation is already here.',
  ],
};

FAKE_ARTICLES['isometric_workflow'] = {
  slug:         'test-isometric-workflow',
  title:        'Multi-Agent AI Systems: How Orchestrators Coordinate Specialized Agents',
  video_script: [
    'A user sends a complex request to the AI orchestration layer.',
    'The orchestrator receives the request and routes it to specialized agents.',
    'Two agents work in parallel: one searches the web, one executes code.',
    'Each agent uses its own set of tools to collect and process data.',
    'Results are merged by the aggregator and delivered as a single output.',
  ],
};

FAKE_ARTICLES['minimal_documentary'] = {
  slug:         'test-minimal-documentary',
  title:        'China Maps Entire Renewable Energy Grid With AI in Record Time',
  video_script: [
    'China mapped its entire renewable energy grid using AI.',
    'Two million kilometers of power lines analyzed in weeks.',
    'The system predicts failures before they happen.',
    'Energy waste dropped forty percent in the pilot region.',
    'This model is now being adopted across three continents.',
  ],
  carousel_slides: [
    { image: 'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&h=1280' },
    { image: 'https://images.pexels.com/photos/159397/solar-panel-array-power-sun-electricity-159397.jpeg?auto=compress&cs=tinysrgb&h=1280' },
    { image: 'https://images.pexels.com/photos/1036936/pexels-photo-1036936.jpeg?auto=compress&cs=tinysrgb&h=1280' },
    { image: 'https://images.pexels.com/photos/2800832/pexels-photo-2800832.jpeg?auto=compress&cs=tinysrgb&h=1280' },
    { image: 'https://images.pexels.com/photos/414837/pexels-photo-414837.jpeg?auto=compress&cs=tinysrgb&h=1280' },
  ],
};

// ─── Fake scenes ──────────────────────────────────────────────────────────────

const FAKE_SCENES = {};

FAKE_SCENES['data_story'] = [
  {
    voiceover:      'Il mercato AI chip cresce del 45% in un anno.',
    on_screen_text: 'Crescita record',
    duration_sec:   5,
    chart_type:     'bar',
    data_points:    [
      { label: '2022', value: 30 },
      { label: '2023', value: 55 },
      { label: '2024', value: 80 },
    ],
    highlight: '80B$',
    trend:     'up',
  },
  {
    voiceover:      'OpenAI vale 80 miliardi. Google DeepMind 50.',
    on_screen_text: 'Chi vale di più',
    duration_sec:   5,
    chart_type:     'comparison',
    data_points:    [
      { label: 'OpenAI',    value: 80 },
      { label: 'DeepMind',  value: 50 },
    ],
    highlight: 'OpenAI',
    trend:     'neutral',
  },
  {
    voiceover:      "L'adozione AI in azienda ha raggiunto il 63 percento.",
    on_screen_text: '63% adozione',
    duration_sec:   4,
    chart_type:     'number_counter',
    data_points:    [{ label: 'adozione AI', value: 63 }],
    highlight:      '63%',
    trend:          'up',
  },
  {
    voiceover:      'La curva di adozione accelera ogni trimestre.',
    on_screen_text: 'Trend trimestrale',
    duration_sec:   5,
    chart_type:     'line',
    data_points:    [
      { label: 'Q1', value: 20 },
      { label: 'Q2', value: 35 },
      { label: 'Q3', value: 55 },
      { label: 'Q4', value: 80 },
    ],
    highlight: 'Q4',
    trend:     'up',
  },
  {
    voiceover:      'Chi non si adatta ora, perde terreno definitivamente.',
    on_screen_text: 'Agisci adesso',
    duration_sec:   4,
    chart_type:     'number_counter',
    data_points:    [{ label: 'aziende rimaste indietro', value: 37 }],
    highlight:      '37%',
    trend:          'down',
  },
];

FAKE_SCENES['kinetic_typography'] = [
  {
    voiceover:      'GPT-5 supera il 90% degli avvocati all\'esame di Stato.',
    on_screen_text: 'GPT-5 passa il bar exam',
    duration_sec:   4,
    tone:           'urgent',
    emphasis_word:  '90%',
    layout:         'single',
    hook:           'GPT-5 è già più bravo di te?',
  },
  {
    voiceover:      'Ragiona su problemi complessi senza perdere il filo.',
    on_screen_text: 'Ragionamento a più passi',
    duration_sec:   4,
    tone:           'informative',
    emphasis_word:  'ragionamento',
    layout:         'single',
    hook:           'Come funziona davvero',
  },
  {
    voiceover:      'Gli errori sono calati del 60% rispetto a GPT-4.',
    on_screen_text: '60% meno errori',
    duration_sec:   4,
    tone:           'urgent',
    emphasis_word:  '60%',
    layout:         'single',
    hook:           'Il gap si è chiuso',
  },
  {
    voiceover:      'Avvocati, medici e ingegneri lo usano già ogni giorno.',
    on_screen_text: 'Già in uso dai professionisti',
    duration_sec:   4,
    tone:           'informative',
    emphasis_word:  'professionisti',
    layout:         'split',
    hook:           'Non è più futuro',
  },
  {
    voiceover:      'La domanda non è se l\'AI sostituisce gli esperti. È quando.',
    on_screen_text: 'La domanda è: quando?',
    duration_sec:   4,
    tone:           'inspiring',
    emphasis_word:  'quando',
    layout:         'single',
    hook:           'Agisci prima della risposta',
  },
];

FAKE_SCENES['slide_deck'] = [
  { scene: 1, voiceover: 'GPT-5 è qui e cambia tutto.', on_screen_text: 'Rivoluzione AI', duration_sec: 4, hook: 'GPT-5 è qui' },
  { scene: 2, voiceover: 'Ragiona passo dopo passo come un esperto umano.', on_screen_text: 'Reasoning mode', duration_sec: 5, hook: 'Come un esperto' },
  { scene: 3, voiceover: 'I benchmark mostrano il 60% di errori in meno rispetto a GPT-4.', on_screen_text: '60% meno errori', duration_sec: 5, hook: '60% meno errori' },
  { scene: 4, voiceover: 'Disponibile oggi su ChatGPT Plus per tutti gli abbonati.', on_screen_text: 'Disponibile oggi', duration_sec: 4, hook: 'Disponibile oggi' },
  { scene: 5, voiceover: 'La gara AI è entrata in una fase completamente nuova.', on_screen_text: 'Nuova fase', duration_sec: 4, hook: 'Nuova fase' },
];

FAKE_SCENES['network_graph'] = [
  {
    voiceover:    'Un sistema multi-agente: orchestratore, strumenti, output.',
    duration_sec: 6,
    nodes: [
      { id: 'orch',   label: 'Orchestrator', type: 'agent',   x: 540, y: 500  },
      { id: 'tool1',  label: 'Web Search',   type: 'tool',    x: 260, y: 900  },
      { id: 'tool2',  label: 'Code Exec',    type: 'tool',    x: 820, y: 900  },
      { id: 'output', label: 'Risposta',     type: 'output',  x: 540, y: 1300 },
    ],
    edges: [
      { from: 'orch',  to: 'tool1'  },
      { from: 'orch',  to: 'tool2'  },
      { from: 'tool1', to: 'output' },
      { from: 'tool2', to: 'output' },
    ],
    reveal_order: ['orch', 'tool1', 'tool2', 'output'],
    scene_title:  'Pipeline multi-agente',
  },
  {
    voiceover:    'I dati entrano grezzi. Escono trasformati dall\'AI.',
    duration_sec: 6,
    nodes: [
      { id: 'in',   label: 'Raw Data', type: 'input',   x: 540, y: 400  },
      { id: 'proc', label: 'AI Model', type: 'process', x: 540, y: 960  },
      { id: 'out',  label: 'Insights', type: 'output',  x: 540, y: 1520 },
    ],
    edges: [
      { from: 'in',   to: 'proc', label: 'feed' },
      { from: 'proc', to: 'out',  label: 'emit' },
    ],
    reveal_order: ['in', 'proc', 'out'],
    scene_title:  'Flusso dati AI',
  },
  {
    voiceover:    'Tre agenti specializzati, un obiettivo comune.',
    duration_sec: 6,
    nodes: [
      { id: 'plan',  label: 'Planner',  type: 'agent',  x: 540, y: 350  },
      { id: 'exec',  label: 'Executor', type: 'agent',  x: 270, y: 900  },
      { id: 'check', label: 'Critic',   type: 'agent',  x: 810, y: 900  },
      { id: 'res',   label: 'Result',   type: 'output', x: 540, y: 1450 },
    ],
    edges: [
      { from: 'plan',  to: 'exec'  },
      { from: 'plan',  to: 'check' },
      { from: 'exec',  to: 'res'   },
      { from: 'check', to: 'res'   },
    ],
    reveal_order: ['plan', 'exec', 'check', 'res'],
    scene_title:  'Agenti cooperativi',
  },
  {
    voiceover:    'Fetch, filter, generate: tre passi, un articolo pronto.',
    duration_sec: 5,
    nodes: [
      { id: 'fetch',  label: 'Fetch',     type: 'input',   x: 540, y: 450  },
      { id: 'filter', label: 'AI Filter', type: 'process', x: 540, y: 960  },
      { id: 'gen',    label: 'Generate',  type: 'tool',    x: 540, y: 1470 },
    ],
    edges: [
      { from: 'fetch',  to: 'filter' },
      { from: 'filter', to: 'gen'    },
    ],
    reveal_order: ['fetch', 'filter', 'gen'],
    scene_title:  'Pipeline in tre passi',
  },
  {
    voiceover:    'Ogni agente risponde a un bisogno. Tu sei al centro.',
    duration_sec: 7,
    nodes: [
      { id: 'user', label: 'User',    type: 'input',  x: 540, y: 960  },
      { id: 'news', label: 'News AI', type: 'agent',  x: 200, y: 480  },
      { id: 'food', label: 'Food AI', type: 'agent',  x: 880, y: 480  },
      { id: 'fit',  label: 'Fit AI',  type: 'agent',  x: 200, y: 1440 },
      { id: 'out',  label: 'Output',  type: 'output', x: 880, y: 1440 },
    ],
    edges: [
      { from: 'user', to: 'news' },
      { from: 'user', to: 'food' },
      { from: 'user', to: 'fit'  },
      { from: 'news', to: 'out'  },
      { from: 'food', to: 'out'  },
      { from: 'fit',  to: 'out'  },
    ],
    reveal_order: ['user', 'news', 'food', 'fit', 'out'],
    scene_title:  'Hub AI personale',
  },
];

FAKE_SCENES['timeline_motion'] = [
  {
    voiceover:     'GPT-1 nel 2018: 117 milioni di parametri. Solo ricerca.',
    duration_sec:  5,
    events:        [{ date: '2018', label: 'GPT-1 — 117M parametri', type: 'milestone' }],
    camera_motion: 'static',
    scene_title:   "L'origine",
  },
  {
    voiceover:     'GPT-3 sconvolge tutto. 175 miliardi. Testo quasi umano.',
    duration_sec:  5,
    events: [
      { date: '2019', label: 'GPT-2 — 1.5B', type: 'milestone' },
      { date: '2020', label: 'GPT-3 — 175B', type: 'milestone' },
    ],
    camera_motion: 'pan_down',
    scene_title:   'Il salto',
  },
  {
    voiceover:     'ChatGPT cambia il mondo in 5 giorni. 100 milioni di utenti.',
    duration_sec:  5,
    events:        [{ date: 'Nov 2022', label: 'ChatGPT — 100M utenti in 5 gg', type: 'solution' }],
    camera_motion: 'zoom_in',
    scene_title:   'Il punto di svolta',
  },
  {
    voiceover:     "GPT-4 supera il 90% degli umani all'esame di legge.",
    duration_sec:  5,
    events:        [{ date: 'Mar 2023', label: 'GPT-4 — livello umano su benchmark', type: 'milestone' }],
    camera_motion: 'pan_down',
    scene_title:   'Livello umano',
  },
  {
    voiceover:     'Oggi GPT-5 ragiona. Dove siamo tra un anno?',
    duration_sec:  4,
    events:        [{ date: '2025', label: 'GPT-5 — reasoning', type: 'now' }],
    camera_motion: 'static',
    scene_title:   'Adesso',
  },
];

FAKE_SCENES['whiteboard'] = [
  {
    voiceover:   "Come funziona un LLM: input, attenzione, output.",
    duration_sec: 7,
    headline:    "Come ragiona un LLM",
    elements: [
      { type: 'rect',   label: 'Input',      position: { x: 50, y: 18 }, size: 'medium', reveal_order: 0 },
      { type: 'arrow',  label: '',           position: { x: 50, y: 33 }, size: 'small',  reveal_order: 1 },
      { type: 'circle', label: 'Attenzione', position: { x: 50, y: 50 }, size: 'large',  reveal_order: 2 },
      { type: 'arrow',  label: '',           position: { x: 50, y: 67 }, size: 'small',  reveal_order: 3 },
      { type: 'rect',   label: 'Output',     position: { x: 50, y: 82 }, size: 'medium', reveal_order: 4 },
    ],
    layout: 'top_down',
  },
  {
    voiceover:   "I dati grezzi entrano. Il training trasforma. Il modello emerge.",
    duration_sec: 7,
    headline:    "Il processo di training",
    elements: [
      { type: 'rect',   label: 'Dati grezzi', position: { x: 50, y: 18 }, size: 'medium', reveal_order: 0 },
      { type: 'arrow',  label: '',            position: { x: 50, y: 33 }, size: 'small',  reveal_order: 1 },
      { type: 'circle', label: 'Training',    position: { x: 50, y: 50 }, size: 'large',  reveal_order: 2 },
      { type: 'arrow',  label: '',            position: { x: 50, y: 67 }, size: 'small',  reveal_order: 3 },
      { type: 'rect',   label: 'Modello AI',  position: { x: 50, y: 82 }, size: 'medium', reveal_order: 4 },
    ],
    layout: 'top_down',
  },
  {
    voiceover:   "Un agente osserva, decide e agisce. In loop continuo.",
    duration_sec: 6,
    headline:    "Il ciclo dell'agente AI",
    elements: [
      { type: 'circle', label: 'Osserva',  position: { x: 50, y: 20 }, size: 'medium', reveal_order: 0 },
      { type: 'arrow',  label: '',         position: { x: 50, y: 38 }, size: 'small',  reveal_order: 1 },
      { type: 'circle', label: 'Decide',   position: { x: 50, y: 55 }, size: 'large',  reveal_order: 2 },
      { type: 'arrow',  label: '',         position: { x: 50, y: 72 }, size: 'small',  reveal_order: 3 },
      { type: 'circle', label: 'Agisce',   position: { x: 50, y: 85 }, size: 'medium', reveal_order: 4 },
    ],
    layout: 'top_down',
  },
  {
    voiceover:   "Tre passi. Una soluzione. Zero passaggi inutili.",
    duration_sec: 5,
    headline:    "Soluzione in 3 passi",
    elements: [
      { type: 'check', label: 'Analisi',    position: { x: 50, y: 30 }, size: 'medium', reveal_order: 0 },
      { type: 'check', label: 'Esecuzione', position: { x: 50, y: 55 }, size: 'medium', reveal_order: 1 },
      { type: 'check', label: 'Risultato',  position: { x: 50, y: 80 }, size: 'large',  reveal_order: 2 },
    ],
    layout: 'top_down',
  },
  {
    voiceover:   "Agenti specializzati connessi: ogni nodo è un esperto.",
    duration_sec: 6,
    headline:    "Rete di agenti esperti",
    elements: [
      { type: 'circle',  label: 'Hub',      position: { x: 50, y: 20 }, size: 'large',  reveal_order: 0 },
      { type: 'arrow',   label: '',         position: { x: 25, y: 45 }, size: 'small',  reveal_order: 1 },
      { type: 'circle',  label: 'Agente A', position: { x: 20, y: 70 }, size: 'medium', reveal_order: 2 },
      { type: 'arrow',   label: '',         position: { x: 75, y: 45 }, size: 'small',  reveal_order: 3 },
      { type: 'circle',  label: 'Agente B', position: { x: 80, y: 70 }, size: 'medium', reveal_order: 4 },
    ],
    layout: 'top_down',
  },
];

FAKE_SCENES['code_terminal'] = [
  {
    voiceover:      "Tre righe di codice. Un agente che legge il web per te.",
    duration_sec:   6,
    terminal_lines: [
      "$ node agent.js --task 'find AI news'",
      "→ Fetching feeds...",
      "→ Found 32 articles",
      "→ AI filter: 8 passed",
      "✓ Done in 4.2s",
    ],
    prompt_prefix:  '$ ',
    highlight_line: 4,
    scene_title:    'Agente in azione',
  },
  {
    voiceover:      "Il codice è semplice. La logica è AI.",
    duration_sec:   7,
    terminal_lines: [
      "const agent = require('./agent');",
      "const articles = await agent.fetch();",
      "const filtered = await agent.filter(articles);",
      "return filtered.slice(0, 5);",
    ],
    prompt_prefix:  'node> ',
    highlight_line: 2,
    scene_title:    "Codice dell'agente",
  },
  {
    voiceover:      "Build completato in meno di tre secondi.",
    duration_sec:   5,
    terminal_lines: [
      '$ npm run build',
      '→ Bundling 42 modules...',
      '→ Minifying CSS...',
      '→ Writing output/...',
      '✓ Build completed in 2.8s',
      '✓ 3 files written',
    ],
    prompt_prefix:  '$ ',
    highlight_line: 4,
    scene_title:    'Build in 3 secondi',
  },
  {
    voiceover:      "Push automatico ogni due ore. Zero intervento manuale.",
    duration_sec:   6,
    terminal_lines: [
      "$ git add output/*.json",
      "$ git commit -m 'AI: 3 new articles'",
      "→ [main a1b2c3d] AI: 3 new articles",
      "$ git push origin main",
      "✓ remote: Deploy started",
    ],
    prompt_prefix:  '$ ',
    highlight_line: 4,
    scene_title:    'Deploy automatico',
  },
  {
    voiceover:      "L'API risponde in millisecondi. L'AI lavora per te.",
    duration_sec:   6,
    terminal_lines: [
      '$ curl -X POST api.deepseek.com/v1/chat',
      '→ Status: 200 OK',
      '→ tokens_used: 842',
      '→ model: deepseek-chat',
      '✓ Response in 0.9s',
    ],
    prompt_prefix:  '$ ',
    highlight_line: 4,
    scene_title:    'Risposta API',
  },
];

FAKE_SCENES['isometric_workflow'] = [
  {
    voiceover:    "Un utente invia una richiesta complessa al sistema AI.",
    duration_sec: 5,
    blocks: [
      { id: 'user', label: 'Utente', type: 'user', iso_col: 1, iso_row: 0 },
    ],
    connections:  [],
    scene_title:  'La richiesta',
    focus_block:  'user',
  },
  {
    voiceover:    "L'orchestratore riceve la richiesta e pianifica la risposta.",
    duration_sec: 6,
    blocks: [
      { id: 'user', label: 'Utente',       type: 'user',    iso_col: 2, iso_row: 0 },
      { id: 'orch', label: 'Orchestrator', type: 'process', iso_col: 0, iso_row: 2 },
    ],
    connections:  [{ from: 'user', to: 'orch', label: 'request' }],
    scene_title:  'Orchestrazione',
    focus_block:  'orch',
  },
  {
    voiceover:    "Due agenti specializzati vengono attivati in parallelo.",
    duration_sec: 7,
    blocks: [
      { id: 'orch', label: 'Orchestrator', type: 'process', iso_col: 1, iso_row: 0 },
      { id: 'web',  label: 'Web Agent',    type: 'input',   iso_col: 0, iso_row: 2 },
      { id: 'code', label: 'Code Agent',   type: 'process', iso_col: 3, iso_row: 1 },
    ],
    connections: [
      { from: 'orch', to: 'web',  label: 'cerca' },
      { from: 'orch', to: 'code', label: 'esegui' },
    ],
    scene_title:  'Agenti paralleli',
    focus_block:  'orch',
  },
  {
    voiceover:    "Ogni agente usa strumenti specifici per raccogliere i dati.",
    duration_sec: 7,
    blocks: [
      { id: 'web',  label: 'Web Agent',  type: 'input',    iso_col: 0, iso_row: 0 },
      { id: 'code', label: 'Code Agent', type: 'process',  iso_col: 3, iso_row: 0 },
      { id: 'db',   label: 'Database',   type: 'database', iso_col: 0, iso_row: 3 },
      { id: 'api',  label: 'API Calls',  type: 'input',    iso_col: 3, iso_row: 2 },
    ],
    connections: [
      { from: 'web',  to: 'db'  },
      { from: 'code', to: 'api' },
    ],
    scene_title:  'Strumenti AI',
    focus_block:  'db',
  },
  {
    voiceover:    "I risultati vengono unificati e consegnati all'utente.",
    duration_sec: 6,
    blocks: [
      { id: 'db',  label: 'Database',  type: 'database', iso_col: 0, iso_row: 0 },
      { id: 'api', label: 'API Calls', type: 'input',    iso_col: 3, iso_row: 0 },
      { id: 'out', label: 'Output',    type: 'output',   iso_col: 1, iso_row: 2 },
    ],
    connections: [
      { from: 'db',  to: 'out', label: 'merge' },
      { from: 'api', to: 'out', label: 'merge' },
    ],
    scene_title:  'Risposta unificata',
    focus_block:  'out',
  },
];

FAKE_ARTICLES['map_explainer'] = {
  slug:         'test-map-explainer',
  title:        'AI Data Centers: The Global Race for Compute Infrastructure',
  video_script: [
    'The United States dominates global AI compute with sixty percent of top data centers.',
    'China has built a parallel AI infrastructure with over three hundred data centers.',
    'Europe is racing to reduce dependence on American cloud providers.',
    'Southeast Asia is emerging as the next frontier for AI infrastructure investment.',
    'The geography of compute will define geopolitical power for the next decade.',
  ],
};

FAKE_SCENES['map_explainer'] = [
  {
    voiceover:    "Gli USA dominano il compute AI globale con il 60% dei data center mondiali.",
    duration_sec: 6,
    countries: [
      { code: 'US', label: 'USA 60%', type: 'highlight' },
    ],
    routes:      [],
    zoom_region: 'world',
    scene_title: 'Dominio USA',
  },
  {
    voiceover:    "La Cina ha costruito un'infrastruttura AI parallela con oltre 300 data center.",
    duration_sec: 6,
    countries: [
      { code: 'US', label: 'USA',  type: 'origin' },
      { code: 'CN', label: 'Cina', type: 'destination' },
    ],
    routes: [
      { from: 'US', to: 'CN', type: 'data' },
    ],
    zoom_region: 'world',
    scene_title: 'USA vs Cina',
  },
  {
    voiceover:    "L'Europa accelera per ridurre la dipendenza dai cloud provider americani.",
    duration_sec: 6,
    countries: [
      { code: 'DE', label: 'Germania', type: 'highlight' },
      { code: 'FR', label: 'Francia',  type: 'highlight' },
      { code: 'NL', label: 'Olanda',   type: 'highlight' },
    ],
    routes: [],
    zoom_region: 'europe',
    scene_title: 'Sovranità europea',
  },
  {
    voiceover:    "Singapore e il Giappone guidano la nuova frontiera AI del Sud-Est asiatico.",
    duration_sec: 6,
    countries: [
      { code: 'SG', label: 'Singapore', type: 'origin' },
      { code: 'JP', label: 'Giappone',  type: 'highlight' },
      { code: 'KR', label: 'Corea',     type: 'highlight' },
    ],
    routes: [
      { from: 'US', to: 'SG', type: 'money' },
    ],
    zoom_region: 'east_asia',
    scene_title: 'Asia emergente',
  },
  {
    voiceover:    "La geografia del compute definirà il potere geopolitico del prossimo decennio.",
    duration_sec: 6,
    countries: [
      { code: 'US', label: 'USA',   type: 'highlight' },
      { code: 'CN', label: 'Cina',  type: 'destination' },
      { code: 'DE', label: 'EU',    type: 'origin' },
    ],
    routes: [
      { from: 'US', to: 'CN', type: 'data' },
      { from: 'DE', to: 'US', type: 'product' },
    ],
    zoom_region: 'world',
    scene_title: 'La mappa del potere',
  },
];

FAKE_SCENES['minimal_documentary'] = [
  {
    voiceover:     "La Cina ha mappato l'intera rete energetica rinnovabile con l'AI.",
    headline:      'La rete energetica mappata',
    subtext:       'Un sistema AI gestisce 2 milioni di km di linee',
    duration_sec:  7,
    text_position: 'bottom',
    ken_burns:     'zoom_in',
    slide_index:   0,
  },
  {
    voiceover:     "Due milioni di chilometri di linee analizzati in settimane.",
    headline:      '2M km analizzati',
    subtext:       'Dati elaborati in tempo reale da modelli neurali',
    duration_sec:  6,
    text_position: 'bottom',
    ken_burns:     'pan_left',
    slide_index:   1,
  },
  {
    voiceover:     "Il sistema prevede i guasti prima che accadano.",
    headline:      'Guasti previsti in anticipo',
    subtext:       'Manutenzione predittiva su scala nazionale',
    duration_sec:  6,
    text_position: 'center',
    ken_burns:     'zoom_out',
    slide_index:   2,
  },
  {
    voiceover:     "Lo spreco energetico è calato del quaranta percento nella regione pilota.",
    headline:      '-40% spreco energetico',
    subtext:       'Risultato nella regione pilota dopo 6 mesi',
    duration_sec:  7,
    text_position: 'bottom',
    ken_burns:     'pan_right',
    slide_index:   3,
  },
  {
    voiceover:     "Questo modello viene ora adottato in tre continenti.",
    headline:      'Tre continenti lo adottano',
    subtext:       'Il futuro della rete energetica globale è già qui',
    duration_sec:  6,
    text_position: 'bottom',
    ken_burns:     'zoom_in',
    slide_index:   4,
  },
];

// ─── Run ──────────────────────────────────────────────────────────────────────

const article = FAKE_ARTICLES[tmplArg] || FAKE_ARTICLES['data_story'];
const scenes  = FAKE_SCENES[tmplArg];

if (!scenes) {
  console.error(`Nessuna FAKE_SCENES definita per il template: ${tmplArg}`);
  console.error('Disponibili:', Object.keys(FAKE_SCENES).join(', '));
  process.exit(1);
}

template.render(article, scenes, agentConfig, outputPath)
  .then(() => {
    const { execSync } = require('child_process');
    try {
      const info = execSync(`ls -lh "${outputPath}"`).toString().trim();
      console.log(`\n✅ ${info}`);
    } catch {
      console.log('\n✅ Render completato:', outputPath);
    }
  })
  .catch(e => {
    console.error('\n❌ Render fallito:', e.message);
    process.exit(1);
  });
