interface CrisisPattern {
  pattern: RegExp;
  type: string;
}

const CRISIS_PATTERNS: CrisisPattern[] = [
  {
    pattern:
      /\b(me van a deportar|deportaci[oó]n inminente|expulsi[oó]n en \d+|mañana me expulsan|en \d+ d[ií]as? (me expulsan|deportan))\b/i,
    type: 'deportation_imminent',
  },
  {
    pattern:
      /\b(violencia|maltrato|me pega|amenaz[ao]|peligro de vida|016|agresor|abuso (físico|sexual))\b/i,
    type: 'gender_violence',
  },
  {
    pattern:
      /\b(sin (techo|alojamiento|casa|donde dormir)|en la calle|desahucio|me echan de casa)\b/i,
    type: 'no_housing',
  },
  {
    pattern:
      /\b(menor (solo|sin documentos|sin papeles|sin adulto)|hijo menor.{0,30}(solo|sin)|niño (abandonado|sin padres))\b/i,
    type: 'unaccompanied_minor',
  },
];

export interface CrisisResult {
  hasCrisis: boolean;
  crisisType?: string;
}

export function detectCrisis(text: string): CrisisResult {
  for (const { pattern, type } of CRISIS_PATTERNS) {
    if (pattern.test(text)) return { hasCrisis: true, crisisType: type };
  }
  return { hasCrisis: false };
}

export const CRISIS_RESOURCES_BLOCK = `
---
⚠️ **Parece que estás en una situación urgente. Aquí tienes recursos de ayuda inmediata:**

- 🆘 **CEAR** (Comisión Española de Ayuda al Refugiado): [cear.es](https://cear.es) · Tel. **91 598 05 35**
- 🆘 **Cruz Roja España**: [cruzroja.es](https://www.cruzroja.es) · Tel. **900 22 02 22**
- 📞 **016** — Violencia de género (gratuito, anónimo, 24h)
- ⚖️ **Turno de oficio** — Solicita abogado gratuito en tu Colegio de Abogados local
- 🏛️ **Defensor del Pueblo**: [defensordelpueblo.es](https://www.defensordelpueblo.es)

---
`;
