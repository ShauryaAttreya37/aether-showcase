import { AETHER } from './config.mjs';

export const REPEAT_COOLDOWN_MS = 60_000;

export function createAlertEngine({ now = Date.now } = {}) {
  let lastTier = 0;
  let lastFiredAt = 0;

  function evaluate({ pm25, doseFraction, forecastPeak, roleKey }) {
    const thresholds = AETHER.ROLES[roleKey].thresholds;
    const reasons = [];
    let tier = 0;

    if (pm25 !== null && pm25 !== undefined) {
      if (pm25 >= thresholds.danger) {
        tier = Math.max(tier, 3);
        reasons.push(`Live ${Math.round(pm25)} µg/m³ at or above danger threshold`);
      } else if (pm25 >= thresholds.caution) {
        tier = Math.max(tier, 2);
        reasons.push(`Live ${Math.round(pm25)} µg/m³ at or above caution threshold`);
      } else if (pm25 >= thresholds.information) {
        tier = Math.max(tier, 1);
        reasons.push(`Live ${Math.round(pm25)} µg/m³ rising`);
      }
    }

    if (doseFraction >= 1) {
      tier = Math.max(tier, 3);
      reasons.push('Shift exposure budget exceeded');
    } else if (doseFraction >= 0.75) {
      tier = Math.max(tier, 2);
      reasons.push(`${Math.round(doseFraction * 100)}% of shift budget used`);
    } else if (doseFraction >= 0.5) {
      tier = Math.max(tier, 1);
      reasons.push('Halfway through shift budget');
    }

    if (forecastPeak !== null && forecastPeak !== undefined) {
      if (forecastPeak >= thresholds.danger) {
        tier = Math.max(tier, 2);
        reasons.push(`Forecast reaches ${Math.round(forecastPeak)} µg/m³ within 2 h`);
      } else if (forecastPeak >= thresholds.caution) {
        tier = Math.max(tier, 1);
        reasons.push(`Forecast rising to ${Math.round(forecastPeak)} µg/m³`);
      }
    }

    return { tier, reasons };
  }

  async function update(inputs, sendAlert) {
    const { tier, reasons } = evaluate(inputs);
    const updatedAt = now();
    const escalated = tier > lastTier;
    const staleRepeat = tier > 0
      && tier === lastTier
      && updatedAt - lastFiredAt > REPEAT_COOLDOWN_MS;
    const cleared = tier === 0 && lastTier > 0;
    let sent = false;

    if (escalated || staleRepeat || cleared) {
      sent = await sendAlert(tier);
      lastFiredAt = updatedAt;
    }

    lastTier = tier;
    return { tier, reasons, sent, fired: escalated || staleRepeat };
  }

  function reset() {
    lastTier = 0;
    lastFiredAt = 0;
  }

  return {
    evaluate,
    update,
    reset,
    get tier() { return lastTier; },
  };
}
