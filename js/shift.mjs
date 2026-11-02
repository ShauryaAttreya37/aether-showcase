/* Runs one work shift through the app's own dose tracker and alert engine. */
import { createAlertEngine } from '../app-js/alerts.mjs';
import { AETHER } from '../app-js/config.mjs';
import { createDoseTracker } from '../app-js/dose.mjs';

const STEP_MINUTES = 1;
const SHIFT_START_MS = Date.UTC(2025, 9, 2, 3, 0);
const FAULT_FROM_HOUR = 3;
const FAULT_TO_HOUR = 4;

const bump = (fraction, centre, width) => Math.exp(-(((fraction - centre) / width) ** 2));

export const PROFILES = {
  steady: { label: 'Steady', shape: () => 1 },
  rush: {
    label: 'Rush hours',
    shape: fraction => 1 + 0.8 * bump(fraction, 0.1, 0.1) + 0.8 * bump(fraction, 0.9, 0.1),
  },
  spike: { label: 'Midday spike', shape: fraction => 1 + bump(fraction, 0.5, 0.06) },
};

export const TIER_NAMES = ['No alert', 'Information', 'Caution', 'Danger'];

function samplePoints({ roleKey, shape, base, fault, hours }) {
  const tracker = createDoseTracker({ storage: null });
  const engine = createAlertEngine();
  const budget = tracker.budgetFor(roleKey);
  const steps = hours * 60 / STEP_MINUTES;

  return Array.from({ length: steps + 1 }, (_, step) => {
    const hour = step * STEP_MINUTES / 60;
    const inFault = fault && hour >= FAULT_FROM_HOUR && hour < FAULT_TO_HOUR;
    const pm25 = inFault ? null : base * shape(step / steps);
    tracker.addSample(pm25, SHIFT_START_MS + step * STEP_MINUTES * 60_000);
    const dose = tracker.summary(roleKey).dose;
    const { tier, reasons } = engine.evaluate({
      pm25,
      doseFraction: dose / budget,
      forecastPeak: null,
      roleKey,
    });
    return { hour, pm25, dose, tier, reasons, fault: inFault };
  });
}

export function simulateShift({ roleKey, profile, base, fault }) {
  const role = AETHER.ROLES[roleKey];
  if (!role) throw new Error(`Unknown role: ${roleKey}`);
  if (!PROFILES[profile]) throw new Error(`Unknown profile: ${profile}`);

  const hours = role.shiftHours;
  const budget = createDoseTracker({ storage: null }).budgetFor(roleKey);
  const points = samplePoints({ roleKey, shape: PROFILES[profile].shape, base, fault, hours });
  const dose = points.at(-1).dose;
  const highestTier = Math.max(...points.map(point => point.tier));
  const firstAtHighest = points.find(point => point.tier === highestTier);
  const overBudget = points.find(point => point.dose >= budget);

  return {
    role,
    hours,
    budget,
    points,
    dose,
    fraction: dose / budget,
    peak: Math.max(...points.map(point => point.pm25 ?? 0)),
    highestTier,
    highestTierHour: firstAtHighest.hour,
    reasons: firstAtHighest.reasons,
    budgetReachedHour: overBudget ? overBudget.hour : null,
    fault: fault ? { from: FAULT_FROM_HOUR, to: FAULT_TO_HOUR } : null,
  };
}

/* Merge consecutive points of one tier. Each run ends where the next begins. */
export function tierRuns(points) {
  return points.reduce((runs, point) => {
    const last = runs.at(-1);
    const closed = last ? [...runs.slice(0, -1), { ...last, to: point.hour }] : [];
    return last?.tier === point.tier
      ? closed
      : [...closed, { from: point.hour, to: point.hour, tier: point.tier }];
  }, []);
}

export function formatDuration(hour) {
  const minutes = Math.round(hour * 60);
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}
