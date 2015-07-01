import Ember from 'ember';
import { add, subtract, multiply, unit, magnitude, reflect } from 'motion-simulator/vectors';
import template from 'motion-simulator/templates/bubble-motion';

export default Ember.Component.extend({
  layout: template,
  tagName: '',

  damping: 0.08, // % of velocity to kill every tick
  coolingRate: 0.01, // % of acceleration to attenuate every tick
  attractorStrength: 0.005, // pixels/ms^2

  key: null, // Provide a key to give your objects continuity across
             // rerenders. Can be a property path or a function.

  keyGetter: Ember.computed('key', function() {
    let key = this.get('key');
    if (key) {
      if (typeof key === 'function') {
        return key;
      } else {
        return (elt) => Ember.get(elt, key);
      }
    }
  }),

  circles: Ember.computed('bubbles', function() {
    this.restart();

    let getKey = this.get('keyGetter');

    let priorCircles = {};
    if (this._circles && getKey) {
      for (let circle of this._circles) {
        let key = getKey(circle.upstream);
        if (key != null) {
          priorCircles[key] = circle;
        }
      }
    }

    return this._circles = this.get('bubbles').map(circle => {
      let position, prevPosition, priorCircle, r;

      if (getKey && (priorCircle = priorCircles[getKey(circle)])) {
        position = priorCircle.position;
        prevPosition = priorCircle.prevPosition;
        r = priorCircle.r;
      } else {
        position = prevPosition = circle.initialPosition || { x: 0, y: 0 };
        r = circle.initialRadius || 0;
      }

      return {
        position,
        prevPosition: position,
        r,
        initialRadius: r,
        finalRadius: circle.finalRadius,
        attractor: circle.attractor,
        upstream: circle
      };
    });
  }),

  didInsertElement: function() {
    this.start();
  },

  start: function() {
    if (this._lastTick) { return; }
    this._lastTick = window.performance.now();

    // This is a harmless approximation to avoid needing to special
    // case the first tick. Every particle will have x===prevX anyway,
    // so the imputed velocity of each will be zero regardless of this
    // value.
    this._prevStepSize = 0.001;
    this.get('circles').forEach(circle => {
      circle.prevPosition = circle.position;
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
    let circles = this.get('circles');
    let positions = this.nextPositions(circles, stepSize);
    for (let iterations = 0; iterations < 3; iterations++) {
      positions = this.applyConstraints(circles, positions);
    }
    this.updatePositions(circles, positions);
    this._prevStepSize = stepSize;
    this._lastTick = timer;
    this._cooling = this._cooling * (1 - this.get('coolingRate'));
    if (this._cooling > 0.05) {
      window.requestAnimationFrame((timer) => this.tick(timer));
    } else {
      this._lastTick = null;
    }
  },

  nextPositions: function(circles, stepSize) {
    let prevStepSize = this._prevStepSize;
    let antiDamping = 1 - this.get('damping');
    let attractorStrength = this.attractorStrength;
    let cooling = this._cooling;
    let newState = new Array(circles.length);

    for (let [circleIndex, circle] of circles.entries()) {
      let { position, prevPosition } = circle;
      let a;

      if (circle.attractor) {
        a = multiply(
          unit(subtract(circle.attractor, position)),
          attractorStrength * cooling * (stepSize + prevStepSize) * stepSize / 2
        );
      } else {
        a = { x: 0, y: 0 };
      }

      let next = add(
        position,
        multiply(subtract(position, prevPosition), (stepSize / prevStepSize) * antiDamping),
        a
      );

      newState[circleIndex] = { next, position };
    }
    return newState;
  },

  effectiveRadius: function() {
    // early in the animation we give each bubble a small effective
    // radius so they can slide freely past each other. Then we let it
    // rapidly come up to full size so they don't overlap.
    return Math.min((1 - this._cooling) * 5, 1);
  },

  applyConstraints: function(circles, newPositions) {
    let effectiveRadius = this.effectiveRadius();
    for (let i = 0; i < circles.length; i++) {
      for (let j = i + 1; j < circles.length; j++) {
        let { next: next1, position: position1 } = newPositions[i];
        let { next: next2, position: position2 } = newPositions[j];
        let r1 = circles[i].finalRadius * effectiveRadius;
        let r2 = circles[j].finalRadius * effectiveRadius;
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

  updatePositions: function(circles, newPositions) {
    let er = this.effectiveRadius();
    for (let [circleIndex, circle] of circles.entries()) {
      let { next, position } = newPositions[circleIndex];
      Ember.set(circle, 'prevPosition', position);
      Ember.set(circle, 'position', next);
      if (circle.r !== circle.finalRadius) {
        Ember.set(circle, 'r', er * (circle.finalRadius - circle.initialRadius) + circle.initialRadius);
      }
    }
  }

});
