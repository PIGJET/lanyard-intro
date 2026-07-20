// Rotating encouragement pool. Randomized, avoids immediate repeats.
const POOL = [
  'Nice cut!',
  'Snip snip.',
  'Keep going!',
  'Clean slice.',
  'The badges fear you.',
  'Scissors? Never met them.',
  'Certified lanyard hazard.',
  'That one had a family.',
  'Almost there!',
  'HR would like a word.',
  'Precision. Grace. Violence.',
  'You may already be a ninja.',
];

// Milestone-aware overrides (still short & playful)
const MILESTONES = {
  25: 'Twenty-five. No notes.',
  50: 'Halfway to... something.',
  75: 'Something stirs at 100...',
  99: 'One more.',
};

let last = -1;
export function pickMessage(cutCount) {
  if (MILESTONES[cutCount]) return MILESTONES[cutCount];
  let i;
  do { i = Math.floor(Math.random() * POOL.length); } while (i === last && POOL.length > 1);
  last = i;
  return POOL[i];
}
