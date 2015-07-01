import Ember from 'ember';
import { add } from 'motion-simulator/vectors';

export function closeToHelper([vector], hash) {
  return add(randomOffset(hash.within || 5), vector);
}

export default Ember.HTMLBars.makeBoundHelper(closeToHelper);

export function randomOffset(distance) {
  return {
    x: distance * (Math.random() * 2 - 1),
    y: distance * (Math.random() * 2 - 1)
  };
}
