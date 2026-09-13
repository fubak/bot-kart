// Keyboard input → normalized control axes. Gamepad support is a later unit.

export interface ControlState {
  throttle: number; // 0..1  (W / ArrowUp)
  brake: number; // 0..1  (S / ArrowDown)
  steer: number; // -1..1 (A/D, Arrows) — +1 = right
  drift: boolean; // held (Shift)
}

export type BindAction = 'throttle' | 'brake' | 'left' | 'right' | 'drift' | 'item';

export const BIND_ACTIONS: readonly BindAction[] = [
  'throttle',
  'brake',
  'left',
  'right',
  'drift',
  'item',
];

export const BIND_LABELS: Record<BindAction, string> = {
  throttle: 'THROTTLE',
  brake: 'BRAKE/REV',
  left: 'STEER LEFT',
  right: 'STEER RIGHT',
  drift: 'DRIFT',
  item: 'ITEM',
};

const DEFAULT_BINDINGS: Record<BindAction, string> = {
  throttle: 'KeyW',
  brake: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  drift: 'ShiftLeft',
  item: 'Space',
};

// Primary (remappable) binding per action, persisted to localStorage.
// Arrow keys + Right Shift stay universal alternates so a rebind never
// removes the fallback scheme.
export const bindings: Record<BindAction, string> = { ...DEFAULT_BINDINGS };

const STORE = 'grok-kart-bindings';
try {
  const saved = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Partial<
    Record<BindAction, string>
  >;
  for (const a of BIND_ACTIONS) if (typeof saved[a] === 'string') bindings[a] = saved[a];
} catch {
  /* corrupt/absent — defaults stand */
}

// Rebind an action; a code already bound elsewhere is cleared there so a
// key never drives two actions (the displaced action shows — until rebound).
export function bindKey(action: BindAction, code: string): void {
  for (const a of BIND_ACTIONS) {
    if (a !== action && bindings[a] === code) bindings[a] = '';
  }
  bindings[action] = code;
  localStorage.setItem(STORE, JSON.stringify(bindings));
}

export function resetBindings(): void {
  Object.assign(bindings, DEFAULT_BINDINGS);
  localStorage.removeItem(STORE);
}

// Short display label for an event.code: KeyW→W, ArrowUp→↑, Space→SPACE.
export function keyName(code: string): string {
  if (!code) return '—';
  const named: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Space: 'SPACE',
    ShiftLeft: 'LSHIFT',
    ShiftRight: 'RSHIFT',
    ControlLeft: 'LCTRL',
    ControlRight: 'RCTRL',
    AltLeft: 'LALT',
    AltRight: 'RALT',
    Enter: 'ENTER',
    Backspace: '⌫',
    Tab: 'TAB',
    CapsLock: 'CAPS',
  };
  if (named[code]) return named[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
  return code.toUpperCase();
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
    throttle: Math.max(k(bindings.throttle), k('ArrowUp')),
    brake: Math.max(k(bindings.brake), k('ArrowDown')),
    steer:
      Math.max(k(bindings.right), k('ArrowRight')) -
      Math.max(k(bindings.left), k('ArrowLeft')),
    drift: keys.has(bindings.drift) || keys.has('ShiftRight'),
  };
}
