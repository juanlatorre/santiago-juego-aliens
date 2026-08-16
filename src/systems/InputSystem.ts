// Input state (GDD §11): twin virtual sticks on touch, WASD+mouse on desktop.
// Systems read this object; presentation layers write to it.

export class InputState {
  moveX = 0;
  moveY = 0; // -1..1
  aimX = 0;
  aimY = 0; // aim direction (unit-ish)
  firing = false;
  speedMult = 1; // power-up speed multiplier, set by the scene each frame
  interactHeld = false; // context button currently pressed
  interactPressed = false; // edge: context button just pressed this frame
}
