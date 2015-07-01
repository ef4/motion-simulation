import { add } from 'motion-simulator/vectors';
import Ember from 'ember';

export default Ember.Component.extend({
  classNames: ['bubble-demo'],

  randomSamples: Ember.computed(function() {
    let output = [];
    for (let id = 0; id < 30; id++) {
      output.push({
        id,
        r: Math.random()*40,
        fraction: Math.random()
      });
    }
    return output;
  }),

  bubbles: Ember.computed('width', 'height', 'splitMode', 'randomSamples', function() {
    let width = this.get('width');
    let height = this.get('height');
    let samples = this.get('randomSamples');
    if (width == null) { return []; }

    if (this.get('splitMode')) {
      let left =  { x:     width / 3, y: height / 2};
      let right = { x: 2 * width / 3, y: height / 2};
      return samples.map(elt => ({
        id: elt.id,
        fraction: elt.fraction,

        attractor: left,
        finalRadius: elt.r * elt.fraction
      })).concat(samples.map(elt => ({
        id: elt.id,
        fraction: elt.fraction,
        attractor: right,
        finalRadius: elt.r * (1 - elt.fraction)
      })));
    } else {
      let center = { x: width / 2, y: height / 2};
      return samples.map(elt => ({
        id: elt.id,
        fraction: elt.fraction,
        attractor: center,
        finalRadius: elt.r
      }));
    }
  }),

  didInsertElement() {
    this.set('width', this.$('svg').width());
    this.set('height', this.$('svg').height());
  },

  actions: {
    toggleMode() {
      this.set('splitMode', !this.get('splitMode'));
    }
  }

});
