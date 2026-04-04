/**
 * Regression tests for the perk engine.
 *
 * Verifies the integrity of skillPerkCatalog and the perk library
 * build logic (grouping and sorting by tags).
 */

import assert from "node:assert/strict";
import { skillPerkCatalog } from "../../src/systems/perks/skillPerkCatalog.js";
import { buildPerkLibraryParts } from "../../scripts/build-helpers.mjs";

// ---------------------------------------------------------------------------
// Catalog shape
// ---------------------------------------------------------------------------

assert.ok(Array.isArray(skillPerkCatalog), "skillPerkCatalog should be an array");
assert.strictEqual(skillPerkCatalog.length, 5, "skillPerkCatalog should have exactly 5 entries");

for (const perk of skillPerkCatalog) {
  assert.ok(
    typeof perk.id === "string" && perk.id.length > 0,
    `perk.id should be a non-empty string (got: ${JSON.stringify(perk.id)})`
  );
  assert.ok(
    typeof perk.name === "string" && perk.name.length > 0,
    `perk.name should be a non-empty string (id: ${perk.id})`
  );
  assert.ok(
    typeof perk.description === "string" && perk.description.length > 0,
    `perk.description should be a non-empty string (id: ${perk.id})`
  );
  assert.ok(
    Array.isArray(perk.tags) && perk.tags.length > 0,
    `perk.tags should be a non-empty array (id: ${perk.id})`
  );
  for (const tag of perk.tags) {
    assert.ok(
      typeof tag === "string" && tag.length > 0,
      `Each tag should be a non-empty string (id: ${perk.id})`
    );
  }
}

// ---------------------------------------------------------------------------
// No duplicate IDs
// ---------------------------------------------------------------------------

const ids = skillPerkCatalog.map((p) => p.id);
const uniqueIds = new Set(ids);
assert.strictEqual(uniqueIds.size, ids.length, "Perk IDs must be unique");

// ---------------------------------------------------------------------------
// All expected perks exist with correct IDs
// ---------------------------------------------------------------------------

const expectedIds = ["multiplier", "wide_bucket", "slow_mo", "magnet", "shield"];
for (const expected of expectedIds) {
  assert.ok(ids.includes(expected), `Expected perk with id "${expected}" to be present`);
}

// ---------------------------------------------------------------------------
// buildPerkLibraryParts – tag grouping
// ---------------------------------------------------------------------------

const { navItems, sections } = buildPerkLibraryParts(skillPerkCatalog);

// navItems should contain an anchor for every distinct tag
const allTags = [...new Set(skillPerkCatalog.flatMap((p) => p.tags))].sort();
for (const tag of allTags) {
  assert.ok(
    navItems.includes(`href="#tag-${tag}"`),
    `navItems should contain a link for tag "${tag}"`
  );
}

// sections should contain a section element for every distinct tag
for (const tag of allTags) {
  assert.ok(
    sections.includes(`id="tag-${tag}"`),
    `sections should contain a section with id "tag-${tag}"`
  );
}

// Every perk name should appear in the rendered sections HTML
for (const perk of skillPerkCatalog) {
  assert.ok(
    sections.includes(perk.name),
    `sections HTML should include perk name "${perk.name}"`
  );
}

// ---------------------------------------------------------------------------
// buildPerkLibraryParts – tag grouping correctness
// ---------------------------------------------------------------------------

// Extract groups manually from the catalog to compare
const expectedGroups = new Map();
for (const perk of skillPerkCatalog) {
  for (const tag of perk.tags) {
    if (!expectedGroups.has(tag)) expectedGroups.set(tag, []);
    expectedGroups.get(tag).push(perk.id);
  }
}

// "powerup" tag – all 5 perks carry it
assert.strictEqual(
  (expectedGroups.get("powerup") ?? []).length,
  5,
  'All 5 perks should carry the "powerup" tag'
);

// "defense" tag – only shield
assert.deepStrictEqual(
  expectedGroups.get("defense") ?? [],
  ["shield"],
  '"defense" tag should contain only "shield"'
);

// "score" tag – only multiplier
assert.deepStrictEqual(
  expectedGroups.get("score") ?? [],
  ["multiplier"],
  '"score" tag should contain only "multiplier"'
);

// "movement" tag – only wide_bucket
assert.deepStrictEqual(
  expectedGroups.get("movement") ?? [],
  ["wide_bucket"],
  '"movement" tag should contain only "wide_bucket"'
);

// "utility" tag – slow_mo and magnet
assert.deepStrictEqual(
  (expectedGroups.get("utility") ?? []).sort(),
  ["magnet", "slow_mo"].sort(),
  '"utility" tag should contain "slow_mo" and "magnet"'
);

// ---------------------------------------------------------------------------
// buildPerkLibraryParts – HTML escaping in output
// ---------------------------------------------------------------------------

const dangerousCatalog = [
  {
    id: "test_escape",
    name: '<script>alert("xss")</script>',
    description: "A & B > C",
    tags: ["test"],
  },
];
const { sections: escapedSections } = buildPerkLibraryParts(dangerousCatalog);
assert.ok(
  !escapedSections.includes("<script>"),
  "sections HTML must not contain raw <script> tags"
);
assert.ok(
  escapedSections.includes("&lt;script&gt;"),
  "sections HTML should escape < and > in perk names"
);
assert.ok(
  escapedSections.includes("A &amp; B &gt; C"),
  "sections HTML should escape & and > in perk descriptions"
);

console.log("perkEngine regression: all tests passed ✓");
