/**
 * Skill & perk catalog for Catch the Chaos.
 *
 * Each entry describes a collectible power-up / skill that can appear
 * as a SPECIAL drop during gameplay.
 *
 * Shape:
 *   id          – unique identifier used in game code
 *   name        – display name shown in perk library and HUD popups
 *   description – short human-readable description of the effect
 *   tags        – array of category strings for grouping in the perk library
 */

/** @type {Array<{id: string, name: string, description: string, tags: string[]}>} */
export const skillPerkCatalog = [
  {
    id: "multiplier",
    name: "Score Multiplier",
    description: "Doubles all points earned for the duration. Stacks with Fever Mode for ×4 total.",
    tags: ["score", "powerup"],
  },
  {
    id: "wide_bucket",
    name: "Big Bucket",
    description: "Widens the catch area, making it easier to intercept falling drops.",
    tags: ["movement", "powerup"],
  },
  {
    id: "slow_mo",
    name: "Slow-Mo",
    description: "Slows all falling drops to 35 % of their normal speed, giving extra reaction time.",
    tags: ["utility", "powerup"],
  },
  {
    id: "magnet",
    name: "Magnet",
    description: "Pulls nearby drops toward the player bucket automatically.",
    tags: ["utility", "powerup"],
  },
  {
    id: "shield",
    name: "Shield",
    description: "Absorbs the next bad drop without losing a life. Consumed on first hit.",
    tags: ["defense", "powerup"],
  },
];
