/**
 * Haptics adapter. On iOS/Android (Capacitor native) uses @capacitor/haptics; in a browser falls back to
 * navigator.vibrate where it exists (iOS Safari has none, so it is silently skipped). Every call is guarded.
 *
 * The kinds are strengths, lightest first (D40): which event gets which is decided in one place, `services/feel.ts`.
 */

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * - `select`: the lightest tick there is (iOS selection feedback): marking a ✕, a drag, a switch.
 * - `light`: a light tap: placing an animal, tapping an animal hello, a small reward.
 * - `medium`: a firmer single tap, the "subtle success" of a finished row, column or color.
 * - `warning`: the gentle warning pattern, for a wrong guess.
 * - `success`: the success pattern, for a solved puzzle or a purchase.
 * - `pulse`: one celebratory heavy pulse, only for a new animal arriving.
 */
export type HapticKind = 'select' | 'light' | 'medium' | 'warning' | 'success' | 'pulse';

/** Browser fallback patterns (ms), kept short. */
export const VIBRATE: Record<HapticKind, number | number[]> = {
  select: 5,
  light: 8,
  medium: 14,
  warning: [16, 50, 16],
  success: [12, 30, 12, 30, 24],
  pulse: 30,
};

let enabled = true;
export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}
export function hapticsEnabled(): boolean {
  return enabled;
}

export function haptic(kind: HapticKind): void {
  if (!enabled) return;
  try {
    if (Capacitor.isNativePlatform()) {
      if (kind === 'warning') void Haptics.notification({ type: NotificationType.Warning });
      else if (kind === 'success') void Haptics.notification({ type: NotificationType.Success });
      else if (kind === 'select') void Haptics.selectionChanged();
      else void Haptics.impact({ style: kind === 'pulse' ? ImpactStyle.Heavy : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light });
      return;
    }
    navigator.vibrate?.(VIBRATE[kind]);
  } catch {
    /* no haptics on this device */
  }
}
