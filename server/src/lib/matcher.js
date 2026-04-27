'use strict';

const PREFIXES = ['july: ', 'eole '];
const SUFFIX = ' - print as required';

function normalise(input) {
  if (input == null) return '';
  let s = String(input).toLowerCase();

  for (const prefix of PREFIXES) {
    if (s.startsWith(prefix)) {
      s = s.slice(prefix.length);
      break;
    }
  }

  if (s.endsWith(SUFFIX)) {
    s = s.slice(0, -SUFFIX.length);
  }

  s = s.replace(/[-:]/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

function findMatch(needle, haystack, getName, { maxDistance = 2 } = {}) {
  const target = normalise(needle);
  if (!target) return null;

  const candidates = haystack.map((entry) => ({
    entry,
    norm: normalise(getName(entry))
  }));

  const exact = candidates.find((c) => c.norm === target);
  if (exact) return { entry: exact.entry, distance: 0, normalisedNeedle: target, normalisedName: exact.norm };

  let best = null;
  for (const c of candidates) {
    const d = levenshtein(target, c.norm);
    if (d <= maxDistance && (best === null || d < best.distance)) {
      best = { entry: c.entry, distance: d, normalisedNeedle: target, normalisedName: c.norm };
    }
  }
  return best;
}

module.exports = { normalise, levenshtein, findMatch };
