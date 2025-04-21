/* Basic elo rating system
 *
 *                      1
 * Expected(A) = -------------------------
 *                          (rB - rA) / 400
 *                  1   +   10
 *
 * updateRating(A) = A + K * (actual - expected)
 */



// Default starting rating
const DEFAULT_RATING = 800;

/**
 * Calculates the expected score between two players.
 * @param {number} ratingA - Rating of Player A.
 * @param {number} ratingB - Rating of Player B.
 * @returns {number} Expected score of Player A (between 0 and 1).
 */
function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Determines a smarter dynamic K-factor based on rating, experience, and volatility.
 * @param {number} rating - Player's current rating (e.g., 800 to 3000)
 * @param {number} gamesPlayed - Total number of games the player has played
 * @param {number} recentWinRate - Optional: Recent win rate between 0 and 1 (for volatility)
 * @returns {number} A dynamic K-factor tailored to the player's state
 */
function getDynamicK(rating, gamesPlayed = 0, recentWinRate = 0.5) {
  // Base K drops as games increase (experience)
  const experienceFactor = Math.max(10, 40 - gamesPlayed * 0.6);

  // High rating means lower K (more stable)
  const ratingFactor = rating >= 2400 ? 10 : rating >= 1800 ? 20 : 30;

  // Volatility factor (if recent win rate is extreme, K increases)
  const volatilityFactor = 1 + Math.pow(Math.abs(recentWinRate - 0.5), 1.1) * 2.2;

  // Final K combines all three (capped within reason)
  const k = Math.min(40, Math.max(10, experienceFactor * volatilityFactor, ratingFactor));
  return Math.round(k);
}

/**
 * Updates the Elo rating of a player after a match.
 * @param {number} rating - Current rating of the player.
 * @param {number} expected - Expected score of the player.
 * @param {number} actual - Actual score of the player (1 = win, 0.5 = draw, 0 = loss).
 * @param {number} [k=32] - K-factor (sensitivity of rating change).
 * @returns {number} New rating after the match.
 */
function updateRating(rating, expected, actual, k = 32) {
  return rating + k * (actual - expected);
}

/**
 * Rates a match between two players using dynamic K-factors.
 * @param {number} ratingA - must be > 800
 * @param {number} ratingB - must be > 800
 * @param {number} resultA - Score of Player A (1 win, 0.5 draw, 0 loss)
 * @param {number} gamesA  - Games played by A
 * @param {number} gamesB  - Games played by B
 * @returns {{ newRatingA: number, newRatingB: number }}
 */
function rateMatch(ratingA, ratingB, resultA, gamesA, gamesB) {
  const resultB = 1 - resultA;
  const expectedA = expectedScore(ratingA, ratingB);
  const expectedB = expectedScore(ratingB, ratingA);

  const kA = getDynamicK(ratingA, gamesA);
  const kB = getDynamicK(ratingB, gamesB);

  const newRatingA = updateRating(ratingA, expectedA, resultA, kA);
  const newRatingB = updateRating(ratingB, expectedB, resultB, kB);

  return {
    newRatingA: Math.round(newRatingA),
    newRatingB: Math.round(newRatingB),
  };
}

/**
 * Returns the default rating for a new player/bot.
 * @returns {number} Default Elo rating.
 */
function getDefaultRating() {
  return DEFAULT_RATING;
}

module.exports = {
  expectedScore,
  updateRating,
  rateMatch,
  getDefaultRating,
};
