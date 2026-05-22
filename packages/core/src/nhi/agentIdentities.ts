export interface AgentIdentity {
  id: string;
  name: string;
  scopes: string[];
  version: string;
}

export const AGENT_IDENTITIES = {
  planner: {
    id: 'agent:planner:v1',
    name: 'planner',
    scopes: ['read:user_context', 'read:conversation_history'],
    version: 'v1',
  },
  normativa: {
    id: 'agent:normativa:v1',
    name: 'normativa',
    scopes: ['read:rag_chunks', 'read:corpus_metadata'],
    version: 'v1',
  },
  eligibility: {
    id: 'agent:eligibility:v1',
    name: 'eligibility',
    scopes: ['read:user_case'],
    version: 'v1',
  },
  guardrail: {
    id: 'agent:guardrail:v1',
    name: 'guardrail',
    scopes: ['read:agent_output'],
    version: 'v1',
  },
} as const satisfies Record<string, AgentIdentity>;
