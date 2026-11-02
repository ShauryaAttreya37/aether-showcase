import { AETHER, aqiBand } from './config.mjs';

const MAX_SAMPLES = 15_000;

export function createDoseTracker({
  storage = globalThis.localStorage ?? null,
  now = Date.now,
  warn = console.warn,
} = {}) {
  const state = {
    doseUgHours: 0,
    samples: [],
    track: [],
    bandSeconds: {},
    bandDose: {},
    peak: 0,
    sum: 0,
    count: 0,
    startedAt: null,
    lastSample: null,
  };

  function reset() {
    state.doseUgHours = 0;
    state.samples = [];
    state.track = [];
    state.bandSeconds = {};
    state.bandDose = {};
    state.peak = 0;
    state.sum = 0;
    state.count = 0;
    state.startedAt = null;
    state.lastSample = null;
    save();
  }

  function addSample(pm25, timestamp) {
    if (pm25 === null || pm25 === undefined || !Number.isFinite(pm25)) {
      // A fault is unmonitored time. Break continuity so the next valid
      // reading cannot integrate across a period for which no samples exist.
      state.lastSample = null;
      return 0;
    }

    const sampledAt = timestamp || now();
    if (state.startedAt === null) state.startedAt = sampledAt;

    let increment = 0;
    if (state.lastSample) {
      const gapSeconds = (sampledAt - state.lastSample.t) / 1_000;
      if (gapSeconds > 0 && gapSeconds <= AETHER.MAX_GAP_SECONDS) {
        const meanConcentration = (state.lastSample.pm25 + pm25) / 2;
        increment = (meanConcentration * gapSeconds) / 3_600;
        state.doseUgHours += increment;

        const band = aqiBand(meanConcentration).name;
        state.bandSeconds[band] = (state.bandSeconds[band] || 0) + gapSeconds;
        state.bandDose[band] = (state.bandDose[band] || 0) + increment;
      }
    }

    state.lastSample = { t: sampledAt, pm25 };
    state.samples.push({ t: sampledAt, pm25, dose: state.doseUgHours });
    if (state.samples.length > MAX_SAMPLES) state.samples.shift();

    state.peak = Math.max(state.peak, pm25);
    state.sum += pm25;
    state.count += 1;
    return increment;
  }

  function addPosition(lat, lon) {
    state.track.push({
      t: now(),
      lat,
      lon,
      pm25: state.lastSample ? state.lastSample.pm25 : null,
    });
  }

  function trackDistanceKm() {
    let total = 0;
    for (let index = 1; index < state.track.length; index += 1) {
      const previous = state.track[index - 1];
      const current = state.track[index];
      const radiusKm = 6_371;
      const deltaLat = (current.lat - previous.lat) * Math.PI / 180;
      const deltaLon = (current.lon - previous.lon) * Math.PI / 180;
      const haversine =
        Math.sin(deltaLat / 2) ** 2
        + Math.cos(previous.lat * Math.PI / 180)
        * Math.cos(current.lat * Math.PI / 180)
        * Math.sin(deltaLon / 2) ** 2;
      total += 2 * radiusKm * Math.asin(Math.sqrt(haversine));
    }
    return total;
  }

  function budgetFor(roleKey) {
    const role = AETHER.ROLES[roleKey];
    return 15 * role.shiftHours * role.exertion;
  }

  function summary(roleKey) {
    const elapsedMs = state.startedAt ? now() - state.startedAt : 0;
    const budget = budgetFor(roleKey);
    return {
      dose: state.doseUgHours,
      budget,
      fraction: state.doseUgHours / budget,
      peak: state.peak,
      mean: state.count ? state.sum / state.count : 0,
      samples: state.count,
      distanceKm: trackDistanceKm(),
      elapsedMs,
      bandSeconds: { ...state.bandSeconds },
      bandDose: { ...state.bandDose },
      startedAt: state.startedAt,
    };
  }

  function save() {
    if (!storage) return;
    try {
      storage.setItem(AETHER.STORAGE_KEY, JSON.stringify({
        doseUgHours: state.doseUgHours,
        bandSeconds: state.bandSeconds,
        bandDose: state.bandDose,
        peak: state.peak,
        sum: state.sum,
        count: state.count,
        startedAt: state.startedAt,
        samples: state.samples.slice(-900),
        track: state.track.slice(-2_000),
      }));
    } catch (error) {
      warn('dose save failed', error);
    }
  }

  function load() {
    if (!storage) return false;
    try {
      const raw = storage.getItem(AETHER.STORAGE_KEY);
      if (!raw) return false;

      Object.assign(state, JSON.parse(raw));
      state.bandDose = state.bandDose || {};
      state.lastSample = null;
      return true;
    } catch (error) {
      warn('dose load failed', error);
      return false;
    }
  }

  function exportShift(roleKey) {
    return {
      exported_at: new Date(now()).toISOString(),
      role: roleKey,
      summary: summary(roleKey),
      samples: state.samples,
      track: state.track,
    };
  }

  function recentSamples(seconds) {
    const cutoff = now() - seconds * 1_000;
    return state.samples.filter(sample => sample.t >= cutoff);
  }

  return {
    reset,
    addSample,
    addPosition,
    summary,
    save,
    load,
    exportShift,
    recentSamples,
    budgetFor,
    get track() { return state.track; },
  };
}
