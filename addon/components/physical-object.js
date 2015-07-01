import Ember from 'ember';
import layout from '../templates/components/physical-object';

export default Ember.Component.extend({
  layout,
  tagName: '',
  didInsertElement() {
    let world = this.get('in');
    if (!world) {
      throw new Error('physical-object must be placed inside a world');
    }
    world.addObject(this);
  },
  willDestroyElement() {
    let world = this.get('in');
    world.removeObject(this);
  },
  place(tracker) {
    if (!this.isDestroyed) {
      this.set('tracker', tracker);
    }
  }
});
