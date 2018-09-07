const K = 32;

export function getExpected(a, b) {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

export function updateRating(expected, actual, current) {
  return Math.round(current + this.k * (actual - expected));
}