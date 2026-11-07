// Revelado progresivo en el cliente (SPEC 01): el servidor emite el texto ya validado
// de una vez y acá se anima a ritmo constante, con todo visible en ≤ REVEAL_MAX_MS.
const REVEAL_MAX_MS = 3000;
const MIN_CHARS_PER_MS = 0.12; // ≈ 2 caracteres por frame a 60 fps

export function revealedLength(total: number, elapsedMs: number): number {
  // Multiplicar antes de dividir evita que el redondeo deje el último carácter para el frame siguiente
  const byCap = Math.floor((elapsedMs * total) / REVEAL_MAX_MS);
  const byMinSpeed = Math.floor(elapsedMs * MIN_CHARS_PER_MS);
  return Math.min(total, Math.max(byCap, byMinSpeed));
}

export interface TextReveal {
  /** Suma texto al objetivo y anima desde lo que ya se ve. */
  append(text: string): void;
  /** Corta la animación y muestra `text` (o el objetivo actual) de inmediato. */
  showNow(text?: string): void;
  /** Se resuelve cuando no queda nada por revelar. */
  done(): Promise<void>;
}

export function createTextReveal(render: (text: string) => void): TextReveal {
  let target = '';
  let shown = 0;
  let base = 0;
  let start = 0;
  let frame: number | null = null;
  let waiters: Array<() => void> = [];

  const settle = () => {
    frame = null;
    waiters.forEach((resolve) => resolve());
    waiters = [];
  };

  const tick = (now: number) => {
    shown = base + revealedLength(target.length - base, now - start);
    render(target.slice(0, shown));
    if (shown >= target.length) settle();
    else frame = requestAnimationFrame(tick);
  };

  return {
    append(text) {
      target += text;
      if (frame === null) {
        base = shown;
        start = performance.now();
        frame = requestAnimationFrame(tick);
      }
    },
    showNow(text) {
      if (frame !== null) cancelAnimationFrame(frame);
      if (text !== undefined) target = text;
      shown = target.length;
      render(target);
      settle();
    },
    done() {
      return frame === null ? Promise.resolve() : new Promise((resolve) => waiters.push(resolve));
    },
  };
}
