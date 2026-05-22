import { checkForCitations } from './citationEnforcer.js';
import { injectDisclaimer } from './disclaimerInjector.js';
import { detectLegalAdvice } from './legalAdviceDetector.js';
import { redactPIIFromOutput } from './piiOutputRedactor.js';

const LEGAL_ADVICE_CANNED =
  'Para evaluar tu situación jurídica personal, es importante que consultes con un abogado o gestor especializado en extranjería. Ellos podrán orientarte con base en tu caso concreto.\n\nPuedes encontrar asistencia jurídica en:\n- **Turno de oficio** (gratuito): solicítalo en el Colegio de Abogados de tu provincia\n- **CEAR**: [cear.es](https://cear.es)\n- **Cruz Roja**: [cruzroja.es](https://www.cruzroja.es)\n\n---\nℹ️ *Lexia es un asistente informativo. NO sustituye el asesoramiento jurídico de un abogado o gestor habilitado.*';

export interface OutputPipelineResult {
  text: string;
  hasCitations: boolean;
  citations: string[];
  hadLegalAdvice: boolean;
}

export function runOutputPipeline(text: string): OutputPipelineResult {
  // Step 1: Citation enforcer
  const { hasCitations, citations } = checkForCitations(text);

  // Step 2: Legal advice detector — replace if detected
  if (detectLegalAdvice(text)) {
    return { text: LEGAL_ADVICE_CANNED, hasCitations: false, citations: [], hadLegalAdvice: true };
  }

  // Step 3: PII output redactor
  const sanitized = redactPIIFromOutput(text);

  // Step 4: Disclaimer injector
  const withDisclaimer = injectDisclaimer(sanitized);

  return { text: withDisclaimer, hasCitations, citations, hadLegalAdvice: false };
}
