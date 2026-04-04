/**
 * Regression tests for the showcase build helpers.
 *
 * Verifies that the HTML generation utilities used to build the
 * showcase (and other static pages) produce correct, safe output.
 */

import assert from "node:assert/strict";
import {
  escapeHtml,
  buildStaticPageNav,
  buildStaticPageHeader,
  buildStaticPageFooter,
  STATIC_PAGE_LINKS,
} from "../../scripts/build-helpers.mjs";

// ---------------------------------------------------------------------------
// escapeHtml
// ---------------------------------------------------------------------------

assert.strictEqual(escapeHtml("hello"), "hello", "plain text should be returned unchanged");
assert.strictEqual(escapeHtml("<b>"), "&lt;b&gt;", "< and > should be escaped");
assert.strictEqual(escapeHtml('"quoted"'), "&quot;quoted&quot;", 'double quotes should be escaped');
assert.strictEqual(escapeHtml("it's"), "it&#39;s", "single quotes should be escaped");
assert.strictEqual(escapeHtml("a & b"), "a &amp; b", "ampersands should be escaped");
assert.strictEqual(
  escapeHtml('<script>alert("xss")</script>'),
  "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
  "XSS payload should be fully escaped"
);
assert.strictEqual(escapeHtml(42), "42", "non-string values should be coerced to string");

// ---------------------------------------------------------------------------
// STATIC_PAGE_LINKS – catalog integrity
// ---------------------------------------------------------------------------

assert.ok(Array.isArray(STATIC_PAGE_LINKS), "STATIC_PAGE_LINKS should be an array");
assert.ok(STATIC_PAGE_LINKS.length >= 2, "STATIC_PAGE_LINKS should contain at least 2 entries");

const requiredKeys = ["game", "perk-library"];
const linkKeys = STATIC_PAGE_LINKS.map((l) => l.key);
for (const key of requiredKeys) {
  assert.ok(linkKeys.includes(key), `STATIC_PAGE_LINKS should include a link with key "${key}"`);
}

for (const link of STATIC_PAGE_LINKS) {
  assert.ok(typeof link.href === "string" && link.href.length > 0, `link.href should be non-empty (key: ${link.key})`);
  assert.ok(typeof link.label === "string" && link.label.length > 0, `link.label should be non-empty (key: ${link.key})`);
  assert.ok(typeof link.key === "string" && link.key.length > 0, "link.key should be non-empty");
}

// ---------------------------------------------------------------------------
// buildStaticPageNav
// ---------------------------------------------------------------------------

const navNoCurrent = buildStaticPageNav("__none__");
assert.ok(typeof navNoCurrent === "string", "buildStaticPageNav should return a string");
assert.ok(
  !navNoCurrent.includes('aria-current="page"'),
  "no link should be marked current when key does not match"
);
for (const link of STATIC_PAGE_LINKS) {
  assert.ok(navNoCurrent.includes(link.href), `nav should contain href "${link.href}"`);
  assert.ok(navNoCurrent.includes(link.label), `nav should contain label "${link.label}"`);
}

// Exactly one link should be marked current when a valid key is supplied
for (const { key } of STATIC_PAGE_LINKS) {
  const nav = buildStaticPageNav(key);
  const occurrences = (nav.match(/aria-current="page"/g) ?? []).length;
  assert.strictEqual(
    occurrences,
    1,
    `Exactly one link should be marked aria-current="page" for key "${key}"`
  );
}

// ---------------------------------------------------------------------------
// buildStaticPageHeader
// ---------------------------------------------------------------------------

const header = buildStaticPageHeader({
  title: "Test Title",
  subtitle: "Test Subtitle",
  currentPage: "showcase",
});

assert.ok(typeof header === "string", "buildStaticPageHeader should return a string");
assert.ok(header.includes("Test Title"), "header should contain the title");
assert.ok(header.includes("Test Subtitle"), "header should contain the subtitle");
assert.ok(header.includes('<section class="hero">'), "header should contain a hero section");
assert.ok(
  header.includes('aria-label="Static page navigation"'),
  "header should contain the navigation landmark"
);

// Special characters in title/subtitle must be escaped
const headerWithSpecialChars = buildStaticPageHeader({
  title: '<b>Bold & Broken</b>',
  subtitle: '"Quoted" & <em>emphasized</em>',
  currentPage: "game",
});
assert.ok(
  !headerWithSpecialChars.includes("<b>"),
  "header should escape < in title"
);
assert.ok(
  headerWithSpecialChars.includes("&lt;b&gt;"),
  "header should output escaped title tags"
);
assert.ok(
  !headerWithSpecialChars.includes("<em>"),
  "header should escape < in subtitle"
);

// ---------------------------------------------------------------------------
// buildStaticPageFooter
// ---------------------------------------------------------------------------

const footer = buildStaticPageFooter("0.42");
assert.ok(typeof footer === "string", "buildStaticPageFooter should return a string");
assert.ok(footer.includes("0.42"), "footer should contain the app version");
assert.ok(footer.includes("<footer>"), "footer should be wrapped in a <footer> element");
assert.ok(
  footer.includes("github.com/nexiusKA/Catch-the-Chaos"),
  "footer should contain the GitHub repository link"
);

// Version string with special characters should be escaped
const footerEscaped = buildStaticPageFooter('<script>bad</script>');
assert.ok(
  !footerEscaped.includes("<script>"),
  "footer should escape a malicious version string"
);

console.log("showcase regression: all tests passed ✓");
