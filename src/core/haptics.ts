// Haptic feedback wrapper (GDD §30). On native Capacitor builds it uses the
// Haptics plugin; on plain browsers it falls back to navigator.vibrate or a
// silent no-op (iOS Safari). All calls are fire-and-forget.
import { Haptics, ImpactStyle } from "@capacitor/haptics";

export function hapticImpact(style: ImpactStyle): void {
  void Haptics.impact({ style }).catch(() => {
    /* no haptics available */
  });
}

export { ImpactStyle };
