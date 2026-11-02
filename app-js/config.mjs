/* Shared configuration. Everything else imports from this module. */

export const AETHER = {
  // The PWA and API share an origin in production. The fallback keeps this
  // pure configuration importable by Node's test runner.
  SERVER_URL: globalThis.location?.origin ?? '',

  BLE: {
    SERVICE: 'a3f10001-2b4c-4d8e-9f01-5a6b7c8d9e0f',
    PM25: 'a3f10002-2b4c-4d8e-9f01-5a6b7c8d9e0f',
    TEMP: 'a3f10003-2b4c-4d8e-9f01-5a6b7c8d9e0f',
    HUMIDITY: 'a3f10004-2b4c-4d8e-9f01-5a6b7c8d9e0f',
    BATTERY: 'a3f10005-2b4c-4d8e-9f01-5a6b7c8d9e0f',
    ALERT: 'a3f10006-2b4c-4d8e-9f01-5a6b7c8d9e0f',
    DEVICE_NAME: 'Aether-Badge',
    PM25_FAULT: 0xffff,
  },

  // CPCB National Air Quality Index PM2.5 sub-index breakpoints. These label
  // readings; the role-specific alert thresholds below drive interventions.
  AQI_BANDS: [
    { level: 0, min: 0, max: 30, name: 'Good', fill: '#2e9e5b', line: '#20713f', ink: '#ffffff', hatch: false },
    { level: 1, min: 30, max: 60, name: 'Satisfactory', fill: '#8cc63f', line: '#5e8f21', ink: '#1d2126', hatch: false },
    { level: 2, min: 60, max: 90, name: 'Moderate', fill: '#e8b93b', line: '#a87f14', ink: '#1d2126', hatch: false },
    { level: 3, min: 90, max: 120, name: 'Poor', fill: '#e8833b', line: '#b05a1a', ink: '#ffffff', hatch: false },
    { level: 4, min: 120, max: 250, name: 'Very Poor', fill: '#d94f4f', line: '#a72f2f', ink: '#ffffff', hatch: true },
    { level: 5, min: 250, max: Infinity, name: 'Severe', fill: '#8e3ba8', line: '#632676', ink: '#ffffff', hatch: true },
  ],

  ROLES: {
    traffic_police: {
      label: 'Traffic police',
      shiftHours: 8,
      exertion: 1.6,
      thresholds: { information: 90, caution: 150, danger: 250 },
      note: 'Long static shifts directly in the traffic plume.',
    },
    delivery_rider: {
      label: 'Delivery rider',
      shiftHours: 10,
      exertion: 2,
      thresholds: { information: 100, caution: 180, danger: 300 },
      note: 'Highest ventilation rate and constant movement through hotspots.',
    },
    construction: {
      label: 'Construction',
      shiftHours: 9,
      exertion: 2.2,
      thresholds: { information: 80, caution: 140, danger: 230 },
      note: 'Heavy exertion plus locally generated dust on top of ambient.',
    },
  },

  DEFAULT_ROLE: 'traffic_police',

  MONO: {
    paper: '#ffffff',
    ink: '#1d2126',
    ink2: '#3e464d',
    ink3: '#7a838b',
    rule: '#c3cad0',
    ruleSoft: '#e2e7ea',
    fill: '#eff2f4',
  },

  STORAGE_KEY: 'aether.shift.v1',
  FORECAST_CACHE_KEY: 'aether.forecast.v2',
  MAX_GAP_SECONDS: 120,
};

export function aqiBand(value) {
  return AETHER.AQI_BANDS.find(band => value <= band.max);
}

export function bandRange(band) {
  return band.max === Infinity ? `${band.min}+` : `${band.min}–${band.max}`;
}
