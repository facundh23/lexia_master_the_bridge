import { checkForCitations } from './citationEnforcer.js';
import { injectDisclaimer } from './disclaimerInjector.js';

export interface OutputPipelineResult {
  text: string;
  hasCitations: boolean;
  citations: string[];
}

export function runOutputPipeline(text: string): OutputPipelineResult {
  const { hasCitations, citations } = checkForCitations(text);
  const withDisclaimer = injectDisclaimer(text);
  return { text: withDisclaimer, hasCitations, citations };
}
