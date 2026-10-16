import type { KillTag } from '@subtick/domain'

/**
 * Every threshold and weight used to find and rank highlights. Changing anything here should bump
 * PARSER_VERSION so old matches can be re-analyzed.
 */
export const highlightConfig = {
  window: {
    /** Footage before the first kill / after the last kill of a moment. */
    preRollSeconds: 4,
    postRollSeconds: 2.5,
    /** Kills further apart than this start a new moment, unless the whole round fits in one clip. */
    mergeGapSeconds: 8,
    maxClipSeconds: 40,
    /** Moments with this many kills (and clutches) may run up to `maxLongClipSeconds`. */
    longClipMinKills: 4,
    maxLongClipSeconds: 60,
    /** Footage before a defuse that has no kills around it. */
    defuseLeadInSeconds: 10,
    /** Footage before the clutch situation starts… */
    clutchLeadInSeconds: 2,
    /** …but never more than this before the first clutch kill (skips the walking). */
    clutchMaxLeadSeconds: 12,
  },
  tags: {
    /** View rotation (degrees) within `flickTicks` before the kill that counts as a flick. */
    flickDegrees: 30,
    flickTicks: 10,
    longShotMeters: 40,
    sniperLongShotMeters: 60,
    lowHp: 15,
    /** Attacker with at most this much equipment killing someone with at least `victimMin`. */
    eco: { attackerMax: 1500, victimMin: 3500 },
  },
  score: {
    perKill: 10,
    killTags: {
      headshot: 3,
      wallbang: 12,
      smoke: 10,
      noscope: 18,
      blind: 15,
      airborne: 12,
      flick: 15,
      long_shot: 8,
      knife: 35,
      taser: 25,
      grenade: 15,
      collateral: 20,
      low_hp: 8,
      eco: 8,
    } satisfies Record<KillTag, number>,
    /** Bonus by number of kills in one moment (index = kills). */
    multiKill: [0, 0, 12, 35, 70, 130],
    /** Multiplier on the multikill bonus when kills come fast (average gap in seconds). */
    speed: [
      { maxGapSeconds: 1.5, factor: 1.3 },
      { maxGapSeconds: 3, factor: 1.15 },
    ],
    clutchWon: { base: 15, perOpponent: 25 },
    defuse: 8,
    ninjaDefuse: 35,
    opening: 4,
    importance: { pistolRound: 0.1, matchPoint: 0.2, overtime: 0.15, lastRound: 0.1 },
  },
  select: {
    minScore: 30,
    maxPerPlayer: 6,
  },
}

export type HighlightConfig = typeof highlightConfig
