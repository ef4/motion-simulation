import Ember from 'ember';

export function xSubtractHelper([a,b]) {
  return a-b;
}

export default Ember.HTMLBars.makeBoundHelper(xSubtractHelper);
