// Tiny dependency-free id generator for optimistic message tempIds
// (kept separate from the "nanoid" npm package used server-side).
export function nanoid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
