const Y = '#fde047', P = '#f9a8d4', G = '#86efac', B = '#7dd3fc';
exports.C = { Y, P, G, B };
exports.T = {
  v1: '13:16 — the “hard mode” tip. Put it in my planner ✍️',
  v2: 'Watch later: “Nobody’s Coming to Save You” — this weekend 🍿',
  g1: 'Love this headline. Make “feels right” glow on hover? ✨',
  g2: 'Add a case study link under “Let’s Talk” → https://guetix.com/projects',
  g3: 'QR code works on mobile ✓',
  d1: 'Signups dipped Monday — compare with the ad spend.',
  d2: 'Churn is up again — check the onboarding emails.',
  s1: 'Cheaper on Mega Store: $219 → https://megastore.com/x2',
  doc: 'Notes on any site, saved on your device. That’s the whole idea.',
};
const T = exports.T;
exports.FULL = [
  { url: 'http://shoply.com/', age: 50, notes: [{ x: 1080, y: 250, text: T.s1, color: G, done: true }] },
  { url: 'http://streamly.tv/', age: 30, notes: [{ x: 560, y: 200, text: T.v1 }, { x: 1080, y: 380, text: T.v2, color: P }] },
  { url: 'http://guetix.com/', wait: 5000, age: 20, notes: [{ x: 760, y: 300, text: T.g1, urgent: true }, { x: 240, y: 470, text: T.g2, color: P }, { x: 1010, y: 520, text: T.g3, color: G, done: true }] },
  { url: 'http://app.pulse.io/', age: 3, notes: [{ x: 620, y: 420, text: T.d1 }, { x: 980, y: 200, el: true, text: T.d2, color: P, urgent: true }] },
];
