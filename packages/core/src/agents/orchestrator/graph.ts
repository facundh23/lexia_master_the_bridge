import { triageQuery } from './triage.js';
import { runNormativaAgent } from '../normativa/agent.js';
import { runEligibilityAgent } from '../eligibility/agent.js';
import { runValidatorAgent } from '../validator/index.js';
import type { OrchestratorInput, OrchestratorOutput } from './state.js';

const OUT_OF_SCOPE_RESPONSE =
  'Lo siento, tu pregunta está fuera del ámbito de información de Lexia. Estoy especializado en la obtención de la nacionalidad española por residencia. Para otras consultas migratorias te recomiendo contactar con CEAR (cear.es), Cruz Roja o un abogado especializado en extranjería.\n\n---\nℹ️ *Lexia es un asistente informativo. NO sustituye el asesoramiento jurídico de un abogado o gestor habilitado.*';

const VALIDATOR_REJECTION_RESPONSE =
  'No puedo proporcionar esa información de forma adecuada en este momento. Para consultas sobre la nacionalidad española por residencia, te recomiendo revisar el portal del Ministerio de Justicia (mjusticia.gob.es) o consultar con un abogado especializado en extranjería.\n\n---\nℹ️ *Lexia es un asistente informativo. NO sustituye el asesoramiento jurídico de un abogado o gestor habilitado.*';

export async function runOrchestrator(input: OrchestratorInput): Promise<OrchestratorOutput> {
  let triage: Awaited<ReturnType<typeof triageQuery>>;
  try {
    triage = await triageQuery(input);
  } catch (err) {
    console.error('[orchestrator] triage error:', String(err));
    return { response: VALIDATOR_REJECTION_RESPONSE, citations: [], route: 'normativa' };
  }

  switch (triage!.route) {
    case 'normativa': {
      const result = await runNormativaAgent({
        content: triage.subQuery,
        conversationHistory: input.conversationHistory,
        userId: input.userId,
        vertical: input.vertical,
      });
      console.log('[orchestrator:normativa] response:', result.response.slice(0, 200));
      const validation = await runValidatorAgent(result.response, 'normativa');
      console.log('[orchestrator:normativa] validation result:', validation.valid, '—', validation.reason);
      if (!validation.valid) {
        console.log('[orchestrator:normativa] retrying with citation reminder...');
        const retry = await runNormativaAgent({
          content: triage.subQuery,
          conversationHistory: input.conversationHistory,
          userId: input.userId,
          vertical: input.vertical,
          forceRetryWithCitationReminder: true,
        });
        const validation2 = await runValidatorAgent(retry.response, 'normativa');
        if (!validation2.valid) {
          console.log('[orchestrator:normativa] retry also failed:', validation2.reason);
          return { response: VALIDATOR_REJECTION_RESPONSE, citations: [], route: 'normativa' };
        }
        return { response: retry.response, citations: retry.citations, route: 'normativa' };
      }
      return { response: result.response, citations: result.citations, route: 'normativa' };
    }

    case 'eligibility': {
      const result = await runEligibilityAgent({
        content: triage.subQuery,
        userId: input.userId,
        caseData: input.caseData,
        conversationHistory: input.conversationHistory,
      });
      const validation = await runValidatorAgent(result.response, 'eligibility');
      if (!validation.valid) {
        return { response: VALIDATOR_REJECTION_RESPONSE, citations: [], route: 'eligibility' };
      }
      return { response: result.response, citations: result.citations, route: 'eligibility' };
    }

    case 'out_of_scope':
    default:
      return { response: OUT_OF_SCOPE_RESPONSE, citations: [], route: 'out_of_scope' };
  }
}
