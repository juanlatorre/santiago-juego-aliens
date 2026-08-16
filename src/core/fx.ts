// Feedback helpers shared by systems — implemented by the presentation layer.
export interface Fx {
  burst(
    x: number,
    y: number,
    color: number,
    count: number,
    speed: number,
    life: number,
    scale?: number,
  ): void;
  shake(intensity: number, ms: number): void;
  muzzleFlash(x: number, y: number, angle: number): void;
  /** Floating damage number (GDD §30). */
  floatText(x: number, y: number, text: string, color: string): void;
}
