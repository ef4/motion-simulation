export function subtract(a, b) {
  return {
    x: a.x - b.x,
    y: a.y - b.y
  };
}

export function add(...vectors) {
  let sum = { x: 0, y : 0 };
  for (let {x, y} of vectors) {
    sum.x += x;
    sum.y += y;
  }
  return sum;
}

export function dotProduct(a, b) {
  return a.x * b.x + a.y * b.y;
}

export function magnitude(a) {
  return Math.sqrt(dotProduct(a, a));
}

// Second argument is optional magnitude, as an optimization for times
// when you've already calculated it.
export function unit(vector, _magnitude = null) {
  if (_magnitude == null) {
    _magnitude = magnitude(vector);
  }
  if (_magnitude === 0) {
    // there is no right answer when magnitude is zero, but rather
    // than explode we can just return a unit vector with an arbitrary
    // direction.
    return { x: 1, y : 0 };
  }
  return multiply(vector, 1 / _magnitude);
}

export function multiply(vector, scalar) {
  return {
    x: vector.x * scalar,
    y: vector.y * scalar
  };
}

export function reflect(vector, normal, attenuation = 1) {
  let normalComponent = multiply(normal, dotProduct(vector, normal));
  let perpendicularComponent = subtract(vector, normalComponent);
  let reflectedComponent = multiply(normalComponent, -1 * attenuation);
  return add(reflectedComponent, perpendicularComponent);
}
