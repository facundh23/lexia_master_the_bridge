import { triageQuery } from './triage.js';
import { runNormativaAgent } from '../normativa/agent.js';
import { runEligibilityAgent } from '../eligibility/agent.js';
import type { OrchestratorInput, OrchestratorOutput } from './state.js';

const OUT_OF_SCOPE_RESPONSE =
  'Lo siento, tu pregunta está fuera del ámbito de información de Lexia. Estoy especializado en la obtención de la nacionalidad española por residencia. Para otras consultas migratorias te recomiendo contactar con CEAR (cear.es), Cruz Roja o un abogado especializado en extranjería.\n\n---\nℹ️ *Lexia es un asistente informativo. NO sustituye el asesoramiento jurídico de un abogado o gestor habilitado.*';

export async function runOrchestrator(
  input: OrchestratorInput,
): Promise<OrchestratorOutput> {
  const triage = await triageQuery(input);

  switch (triage.route) {
    case 'normativa': {
      const result = await runNormativaAgent({
        content: triage.subQuery,
        conversationHistory: input.conversationHistory,
        userId: input.userId,
        vertical: input.vertical,
      });
      return { response: result.response, citations: result.citations, route: 'normativa' };
    }

    case 'eligibility': {
      const result = await runEligibilityAgent({
        content: triage.subQuery,
        caseData: input.caseData,
        conversationHistory: input.conversationHistory,
      });
      return {
        response: result.response,
        citations: result.citations,
        route: 'eligibility',
      };
    }

    case 'out_of_scope':
    default:
      return { response: OUT_OF_SCOPE_RESPONSE, citations: [], route: 'out_of_scope' };
  }
}
