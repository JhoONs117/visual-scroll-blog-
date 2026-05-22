'use strict';

const stub = name => ({
  render: () => { throw new Error(`Template ${name} non ancora implementato`); },
});

module.exports = {
  'slide_deck':          require('./slide-deck'),
  'kinetic_typography':  stub('kinetic_typography'),
  'data_reveal':         stub('data_reveal'),
  'recipe_reveal':       stub('recipe_reveal'),
  'coach_breakdown':     stub('coach_breakdown'),
  'avatar_presenter':    stub('avatar_presenter'),
};
