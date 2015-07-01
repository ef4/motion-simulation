import Ember from 'ember';

export default Ember.Component.extend({
  classNames: ['bubble-demo'],

  randomSamples: Ember.computed(function() {
    let output = [];
    for (let id = 0; id < 30; id++) {
      let amount = Math.random()*40;
      let fraction = Math.random();
      output.push({
        id,
        totalThings: amount,
        fraction,
        redThings: fraction * amount,
        blackThings: (1 - fraction) * amount
      });
    }
    return output;
  }),

  leftSide: Ember.computed('width', 'height', function() {
    return { x: this.get('width') / 3, y: this.get('height') / 2};
  }),

  rightSide: Ember.computed('width', 'height', function() {
    return { x: 2 * this.get('width') / 3, y: this.get('height') / 2};
  }),

  middle: Ember.computed('width', 'height', function() {
    return { x: this.get('width') / 2, y: this.get('height') / 2};
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
