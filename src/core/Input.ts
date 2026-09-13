// Keyboard input → normalized control axes. Gamepad support is a later unit.

export interface ControlState {
  throttle: number; // 0..1  (W / ArrowUp)
  brake: number; // 0..1  (S / ArrowDown)
  steer: number; // -1..1 (A/D, Arrows) — +1 = right
  drift: boolean; // held (Shift)
}

const keys = new Set<string>();

export function initInput(): void {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
}

export function pollInput(): ControlState {
  const k = (c: string) => (keys.has(c) ? 1 : 0);
  return {
    throttle: Math.max(k('KeyW'), k('ArrowUp')),
    brake: Math.max(k('KeyS'), k('ArrowDown')),
    steer:
      Math.max(k('KeyD'), k('ArrowRight')) -
      Math.max(k('KeyA'), k('ArrowLeft')),
    drift: keys.has('ShiftLeft') || keys.has('ShiftRight'),
  };
}
