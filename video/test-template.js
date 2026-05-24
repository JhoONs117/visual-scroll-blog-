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
