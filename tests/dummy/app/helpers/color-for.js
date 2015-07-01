import Ember from 'ember';

export function colorForHelper([fraction]) {
  return `rgb(${Math.floor(255*fraction)}, 40, 40)`;
}

export default Ember.HTMLBars.makeBoundHelper(colorForHelper);
