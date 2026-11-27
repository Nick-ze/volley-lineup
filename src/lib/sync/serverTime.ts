/**
 * v10 audit M2: the save time of an edit, in the server's time.
 *
 * The most recent save wins per record, and "most recent" is decided by the time each device
 * notes for its change. With the device's own clock, a device whose clock runs ahead won every
 * conflict it had an unsynced change for (and one that runs behind lost every one), also against
 * saves that really were later. So the engine measures how far the device's clock is from the
 * server's — every pull answers with the server's time — and notes changes in server time.
 *
 * The measurement is only used while it can be trusted:
 * - it lives in memory only: after an app start, and on a device that has never pulled, changes
 *   are noted with the device's clock, exactly as before, until the first pull;
 * - it is dropped as soon as the device's clock has not moved in step with a clock that can't be
 *   set (`Clock.steady`) since the measurement: the clock was changed, or the device slept — in
 *   both cases the device's clock is used again, as before, until the next pull measures anew;
 * - a pull whose answer took too long, or whose time can't be read, measures nothing.
 * Offline with a trusted measurement, changes keep being noted in server time.
 *
 * Changes noted with the device's clock earlier in the same app run (before its first pull, or
 * while offline since the app started) are converted once a pull has measured the offset
 * (`deviceStampsInServerTime`) — but only those for which the device's clock has demonstrably
 * moved in step with the steady clock since they were noted. Everything else keeps the time it
 * has: nothing from an earlier app run is ever touched.
 *
 * Only the save times of changes use this. Live holds, the status and retry times stay on the
 * device's clock.
 */
import { normalizeTimestamp } from '@/domain/syncSchema';

import type { Clock, EngineCore } from './core';

/** A pull that took longer than this doesn't say precisely enough what the server's time was. */
export const MAX_ROUND_TRIP_MS = 10_000;
/** How far the device's clock may leave the steady clock before the measurement is dropped. */
export const MAX_CLOCK_DRIFT_MS = 5_000;

export interface ServerTime {
  /** Server time minus device time, in ms, when it was measured. */
  offset: number;
  /** The device's clock and the steady clock at that moment. */
  wall: number;
  steady: number;
}

/** A save time noted with the device's clock: both clocks at that moment. */
export interface DeviceStamp {
  wall: number;
  steady: number;
}

/** At most this many device-clock save times are remembered for a later conversion. */
const MAX_DEVICE_STAMPS = 1000;

/** The clock that can't be set (ms from any origin); a clock without one counts as steady. */
const steadyOf = (clock: Clock): number => clock.steady?.() ?? clock.now();

/**
 * Notes the server's time from a pull: `serverNow` as the answer gave it, `sentAt` / `receivedAt`
 * the device's clock around the request (the server read its clock somewhere in between: the
 * middle is taken, so the error is at most half the round trip). True when it was measured.
 */
export function measureServerTime(
  core: EngineCore,
  serverNow: string,
  sentAt: number,
  receivedAt: number,
): boolean {
  const server = Date.parse(normalizeTimestamp(serverNow) ?? '');
  const roundTrip = receivedAt - sentAt;
  if (Number.isNaN(server) || roundTrip < 0 || roundTrip > MAX_ROUND_TRIP_MS) return false;
  core.serverTime = {
    offset: Math.round(server - (sentAt + receivedAt) / 2),
    wall: receivedAt,
    steady: steadyOf(core.clock),
  };
  return true;
}

/** The device's time as a save time, remembered so that it can be converted later. */
function deviceTime(core: EngineCore, wall: number, steady: number): string {
  const iso = new Date(wall).toISOString();
  if (core.deviceStamps.size >= MAX_DEVICE_STAMPS) {
    const oldest = core.deviceStamps.keys().next();
    if (!oldest.done) core.deviceStamps.delete(oldest.value);
  }
  core.deviceStamps.set(iso, { wall, steady });
  return iso;
}

/** The time to note for a change made now: server time when it is known, else the device's. */
export function saveTime(core: EngineCore): string {
  const wall = core.clock.now();
  const steady = steadyOf(core.clock);
  const measured = core.serverTime;
  if (!measured) return deviceTime(core, wall, steady);
  const drift = wall - measured.wall - (steady - measured.steady);
  if (Math.abs(drift) > MAX_CLOCK_DRIFT_MS) {
    core.serverTime = null;
    return deviceTime(core, wall, steady);
  }
  return new Date(wall + measured.offset).toISOString();
}

/**
 * The device-clock save times of this app run in server time (old time → new time), for the
 * measurement just made; the remembered times are forgotten either way. A time is only
 * converted when the device's clock moved in step with the steady clock between then and the
 * measurement — else nobody can say what the server's time was then, and it stays as it is.
 */
export function deviceStampsInServerTime(core: EngineCore): Map<string, string> {
  const converted = new Map<string, string>();
  const measured = core.serverTime;
  if (measured) {
    for (const [iso, stamp] of core.deviceStamps) {
      const drift = measured.wall - stamp.wall - (measured.steady - stamp.steady);
      if (Math.abs(drift) > MAX_CLOCK_DRIFT_MS) continue;
      const server = new Date(stamp.wall + measured.offset).toISOString();
      if (server !== iso) converted.set(iso, server);
    }
    core.deviceStamps.clear();
  }
  return converted;
}
