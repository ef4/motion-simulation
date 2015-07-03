import Ember from 'ember';
import { add, subtract, multiply, unit, magnitude, reflect } from '../vectors';
import template from '../templates/components/motion-simulator';

export default Ember.Component.extend({
  layout: template,
  tagName: '',

  damping: 0.08, // % of velocity to kill every tick
  coolingRate: 0.01, // % of acceleration to attenuate every tick
  attractorStrength: 0.005, // pixels/ms^2
  attractorNearLimit: 4,    // pixels
  collisionsEnabled: true,

  init() {
    this._super();
    this._desiredObjects = [];
  },

  addObject(obj) {
    this._desiredObjects.push(obj);
    this.propertyDidChange('objects');
  },

  removeObject(obj) {
    for (let [index, o] of this._desiredObjects.entries()) {
      if (o === obj) {
        this._desiredObjects.splice(index, 1);
        this.propertyDidChange('objects');
        return;
      }
    }
  },

  objects: Ember.computed('resumeOn', function() {
    this.restart();

    let priorObjects = {};
    if (this._objects) {
      for (let object of this._objects) {
        let key = object.upstream.get('identity');
        if (key != null) {
          priorObjects[key] = object;
        }
      }
    }

    return this._objects = this._desiredObjects.map(object => {
      let position, prevPosition, priorObject, r;

      if ((priorObject = priorObjects[object.get('identity')])) {
        position = priorObject.position;
        prevPosition = priorObject.prevPosition;
        r = priorObject.r;
      } else {
        position = prevPosition = object.get('initialPosition') || { x: 0, y: 0 };
        r = object.get('initialRadius') || 0;
      }
      let tracker = {
        position,
        prevPosition: position,
        r,
        initialRadius: r,
        // we copy this off as a performance optimization, because
        // applyConstraints hits it a lot in a very hot path.
        finalRadius: object.get('finalRadius'),
        upstream: object
      };
      object.place(tracker);
      return tracker;
    });
  }),

  // This exists to ensure that objects will always recompute after
  // being invalidated.
  motionState: Ember.computed('objects', function() {
    this.get('objects');
    return '';
  }),

  didInsertElement: function() {
    if (this.get('ready')) {
      // The user may optionally provide a `ready` action hander that
      // we will call before we start, allowing them to do any
      // necessary setup like measuring the DOM.
      this.sendAction('ready', () => this.start());
    } else {
      this.start();
    }
  },

  start: function() {
    this.set('chartInitialized', true);
    if (this._lastTick) { return; }
    this._lastTick = window.performance.now();

    // This is a harmless approximation to avoid needing to special
    // case the first tick. Every particle will have x===prevX anyway,
    // so the imputed velocity of each will be zero regardless of this
    // value.
    this._prevStepSize = 0.001;
    this.get('objects').forEach(object => {
      object.prevPosition = object.position;
    });

    this._cooling = 1;
    window.requestAnimationFrame((timer) => this.tick(timer));
  },

  restart: function() {
    this._cooling = 1;
    this.start();
  },

  tick: function(timer) {
    if (this.isDestroyed) { return; }
    let stepSize = timer - this._lastTick;
    if (stepSize > 64) {
      // If the app has totally blown its frame budget for any reason
      // (including moving away to another tab), it is better to
      // stutter the animation than try to let the simulation "catch
      // up" an interpolate across a big time step.
      stepSize = 1;
    }
    let objects = this.get('objects');
    let positions = this.nextPositions(objects, stepSize);
    if (this.get('collisionsEnabled')) {
      for (let iterations = 0; iterations < 3; iterations++) {
        positions = this.applyConstraints(objects, positions);
      }
    }
    this.updatePositions(objects, positions);
    this._prevStepSize = stepSize;
    this._lastTick = timer;
    this._cooling = this._cooling * (1 - this.get('coolingRate'));
    if (this._cooling > 0.05) {
      window.requestAnimationFrame((timer) => this.tick(timer));
    } else {
      this._lastTick = null;
    }
  },

  // Attractors are currently implemented as a constant force that is
  // independent of distance *except* that the force attenuates to
  // zero as you get very close, in order to prevent objects that are
  // sitting on their attractors from vibrating.
  attractorForce: Ember.computed('attractorStrength', function() {
    let strength = this.get('attractorStrength');
    let cutoff = this.get('attractorNearLimit');
    return (attractor, position, stepSize, prevStepSize, cooling) => {
      let separation = subtract(attractor, position);
      let distance = magnitude(separation);
      let attenuation = 1;
      if (distance < cutoff) {
        attenuation = distance * distance / (cutoff * cutoff);
      }
      return multiply(
        unit(separation),
        attenuation * strength * cooling * (stepSize + prevStepSize) * stepSize / 2
      );
    };
  }),

  nextPositions: function(objects, stepSize) {
    let prevStepSize = this._prevStepSize;
    let antiDamping = 1 - this.get('damping');
    let attractorForce = this.get('attractorForce');
    let cooling = this._cooling;
    let newState = new Array(objects.length);

    for (let [objectIndex, object] of objects.entries()) {
      let { position, prevPosition } = object;
      let attractor = object.upstream.get('attractor');
      let a;

      if (attractor) {
        a = attractorForce(attractor, position, stepSize, prevStepSize, cooling);
      } else {
        a = { x: 0, y: 0 };
      }

      let next = add(
        position,
        multiply(subtract(position, prevPosition), (stepSize / prevStepSize) * antiDamping),
        a
      );

      newState[objectIndex] = { next, position };
    }
    return newState;
  },

  effectiveRadius: function() {
    // early in the animation we give each bubble a small effective
    // radius so they can slide freely past each other. Then we let it
    // rapidly come up to full size so they don't overlap.
    return Math.min((1 - this._cooling) * 5, 1);
  },

  applyConstraints: function(objects, newPositions) {
    let effectiveRadius = this.effectiveRadius();
    for (let i = 0; i < objects.length; i++) {
      for (let j = i + 1; j < objects.length; j++) {
        let { next: next1, position: position1 } = newPositions[i];
        let { next: next2, position: position2 } = newPositions[j];
        let r1 = objects[i].finalRadius * effectiveRadius;
        let r2 = objects[j].finalRadius * effectiveRadius;
        let separation = subtract(next1, next2);
        let distance = magnitude(separation);
        let normal = unit(separation, distance);
        let gap = distance - r1 - r2;
        if (gap < 0) {
          let massRatio = r1 * r1 / (r1 * r1 + r2 * r2);
          newPositions[j].next = add(next2, multiply(normal, gap * massRatio));
          newPositions[i].next = add(next1, multiply(normal, gap * (massRatio - 1)));
          if (this.elasticCollisions) {
            newPositions[j].position = subtract(newPositions[j].next, reflect(subtract(next2, position2), normal, 0.5));
            newPositions[i].position = subtract(newPositions[i].next, reflect(subtract(next1, position1), normal, 0.5));
          }
        }
      }
    }
    return newPositions;
  },

  updatePositions: function(objects, newPositions) {
    let er = this.effectiveRadius();
    for (let [objectIndex, object] of objects.entries()) {
      let { next, position } = newPositions[objectIndex];
      let finalRadius = object.upstream.get('finalRadius');
      object.finalRadius = finalRadius;
      Ember.set(object, 'prevPosition', position);
      Ember.set(object, 'position', next);
      if (object.r !== finalRadius) {
        Ember.set(object, 'r', er * (finalRadius - object.initialRadius) + object.initialRadius);
      }
    }
  }

});
