import Ember from 'ember';

export function xMultiplyHelper([a,b]) {
  return a*b;
}

export default Ember.HTMLBars.makeBoundHelper(xMultiplyHelper);
