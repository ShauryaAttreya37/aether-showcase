import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AETHER } from '../app-js/config.mjs';
import { createDoseTracker } from '../app-js/dose.mjs';
import { formatDuration, PROFILES, simulateShift, tierRuns } from '../js/shift.mjs';

const steady = { roleKey: 'traffic_police', profile: 'steady', base: 100, fault: false };

test('steady exposure integrates to concentration times hours', () => {
  const shift = simulateShift(steady);

  assert.ok(Math.abs(shift.dose - 800) < 0.001, `dose was ${shift.dose}`);
  assert.equal(shift.hours, AETHER.ROLES.traffic_police.shiftHours);
});

test('budget comes from the shipped dose tracker', () => {
  const tracker = createDoseTracker({ storage: null });

  for (const roleKey of Object.keys(AETHER.ROLES)) {
    const shift = simulateShift({ ...steady, roleKey });
    assert.equal(shift.budget, tracker.budgetFor(roleKey));
  }
});

test('reports the hour the budget is first reached', () => {
  const shift = simulateShift(steady);

  // Budget 192 µg·h/m³ at a steady 100 µg/m³ takes 1.92 hours.
  assert.ok(Math.abs(shift.budgetReachedHour - 1.92) < 0.02, `was ${shift.budgetReachedHour}`);
});

test('budgetReachedHour is null when the shift stays under budget', () => {
  const shift = simulateShift({ ...steady, base: 10 });

  assert.equal(shift.budgetReachedHour, null);
  assert.ok(shift.fraction < 1);
});

test('a sensor fault adds no dose and leaves a null reading', () => {
  const clean = simulateShift(steady);
  const faulty = simulateShift({ ...steady, fault: true });
  const during = faulty.points.filter(point => point.fault);

  assert.ok(during.length > 0);
  assert.ok(during.every(point => point.pm25 === null));
  assert.equal(during[0].dose, during.at(-1).dose);
  assert.ok(clean.dose - faulty.dose >= 100, 'one hour at 100 µg/m³ should be missing');
});

test('alert tier follows the shipped thresholds', () => {
  const low = simulateShift({ ...steady, base: 10 });
  const danger = simulateShift({ ...steady, base: 250 });

  assert.equal(low.highestTier, 0);
  assert.equal(danger.highestTier, 3);
  assert.equal(danger.points[0].tier, 3);
  assert.ok(danger.reasons.some(reason => reason.includes('danger threshold')));
});

test('dose never decreases', () => {
  for (const profile of Object.keys(PROFILES)) {
    const { points } = simulateShift({ ...steady, profile, fault: true });
    points.slice(1).forEach((point, index) => {
      assert.ok(point.dose >= points[index].dose);
    });
  }
});

test('a rush-hour profile peaks above its base level', () => {
  const shift = simulateShift({ ...steady, profile: 'rush' });

  assert.ok(shift.peak > steady.base);
  assert.ok(shift.dose > 800);
});

test('rejects an unknown role or profile', () => {
  assert.throws(() => simulateShift({ ...steady, roleKey: 'pilot' }), /role/);
  assert.throws(() => simulateShift({ ...steady, profile: 'storm' }), /profile/);
});

test('formatDuration writes hours and zero-padded minutes', () => {
  assert.equal(formatDuration(1.92), '1 h 55 min');
  assert.equal(formatDuration(0), '0 h 00 min');
});

test('tierRuns merges consecutive points and covers the whole shift', () => {
  const runs = tierRuns([
    { hour: 0, tier: 0 },
    { hour: 1, tier: 0 },
    { hour: 2, tier: 2 },
    { hour: 3, tier: 2 },
    { hour: 4, tier: 3 },
  ]);

  assert.deepEqual(runs, [
    { from: 0, to: 2, tier: 0 },
    { from: 2, to: 4, tier: 2 },
    { from: 4, to: 4, tier: 3 },
  ]);
});
