import { describe, it, expect } from 'vitest';

// Smoke test: proves the Vitest + jsdom harness is wired up before we write
// real regression tests against the stores/components.
describe('test harness', () => {
  it('runs and evaluates assertions', () => {
    expect(1 + 1).toBe(2);
  });
});
