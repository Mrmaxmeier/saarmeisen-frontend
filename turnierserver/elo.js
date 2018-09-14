const K = 8;

function getExpected(a, b) {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

function updateRating(expected, actual, current) {
  return Math.round(current + K * (actual - expected));
}

module.exports = function process(a, b) {
  let expectedA = getExpected(a.elo, b.elo);
  let expectedB = getExpected(b.elo, a.elo);

  let actualA = 0.5;
  let actualB = 0.5;
  if (a.points > b.points) {
    actualA = 1;
    actualB = 0;
  } else if (b.points > a.points) {
    actualB = 1;
    actualA = 0;
  }
  return {
    A: updateRating(expectedA, actualA, a.elo),
    B: updateRating(expectedB, actualB, b.elo)
  };
};
