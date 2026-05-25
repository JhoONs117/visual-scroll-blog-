'use strict';

const stub = name => ({
  render: () => { throw new Error(`Template ${name} non ancora implementato`); },
});

module.exports = {
  'slide_deck':           require('./slide-deck'),
  'kinetic_typography':   require('./kinetic-typography'),
  'data_story':           require('./data-story'),
  'timeline_motion':      require('./timeline-motion'),
  'network_graph':        require('./network-graph'),
  'minimal_documentary':  require('./minimal-documentary'),
  'code_terminal':        require('./code-terminal'),
  'whiteboard':           require('./whiteboard'),
  'isometric_workflow':   require('./isometric-workflow'),
  'map_explainer':        require('./map-explainer'),
  'data_reveal':          stub('data_reveal'),
  'recipe_reveal':       stub('recipe_reveal'),
  'coach_breakdown':     stub('coach_breakdown'),
  'avatar_presenter':    stub('avatar_presenter'),
};
