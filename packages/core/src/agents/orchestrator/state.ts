export type Route = 'normativa' | 'eligibility' | 'out_of_scope';

export interface CaseData {
  countryOrigin?: string;
  arrivalDate?: string;
  residenceStatus?: string;
  hasChildren?: boolean;
}

export interface OrchestratorInput {
  content: string;
  userId: string;
  vertical: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  caseData?: CaseData;
}

export interface OrchestratorOutput {
  response: string;
  citations: string[];
  route: Route;
}
