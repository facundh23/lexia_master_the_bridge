import { describe, it, expect } from 'vitest';
import { NORMATIVA_SYSTEM_PROMPT } from '../../src/agents/normativa/prompt.js';
import { ELIGIBILITY_SYSTEM_PROMPT } from '../../src/agents/eligibility/prompt.js';
import { AGENT_IDENTITIES } from '../../src/nhi/agentIdentities.js';

describe('system prompts', () => {
  it('normativa prompt is a non-empty string', () => {
    expect(typeof NORMATIVA_SYSTEM_PROMPT).toBe('string');
    expect(NORMATIVA_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it('eligibility prompt is a non-empty string', () => {
    expect(typeof ELIGIBILITY_SYSTEM_PROMPT).toBe('string');
    expect(ELIGIBILITY_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it('normativa prompt contains canary comment format when env token starts with LEXIA_CANARY', () => {
    if (!process.env.LEXIA_CANARY_TOKEN) {
      expect(NORMATIVA_SYSTEM_PROMPT).not.toContain('<!--');
    } else {
      expect(NORMATIVA_SYSTEM_PROMPT).toContain('<!--');
      expect(NORMATIVA_SYSTEM_PROMPT).toContain(process.env.LEXIA_CANARY_TOKEN);
    }
  });
});

describe('AGENT_IDENTITIES', () => {
  it('planner tiene id y scopes correctos', () => {
    expect(AGENT_IDENTITIES.planner.id).toBe('agent:planner:v1');
    expect(AGENT_IDENTITIES.planner.scopes).toContain('read:user_context');
    expect(AGENT_IDENTITIES.planner.scopes).toContain('read:conversation_history');
  });

  it('normativa tiene scopes de RAG', () => {
    expect(AGENT_IDENTITIES.normativa.id).toBe('agent:normativa:v1');
    expect(AGENT_IDENTITIES.normativa.scopes).toContain('read:rag_chunks');
  });

  it('eligibility tiene scope de caso', () => {
    expect(AGENT_IDENTITIES.eligibility.id).toBe('agent:eligibility:v1');
    expect(AGENT_IDENTITIES.eligibility.scopes).toContain('read:user_case');
  });

  it('guardrail tiene scope de output', () => {
    expect(AGENT_IDENTITIES.guardrail.id).toBe('agent:guardrail:v1');
    expect(AGENT_IDENTITIES.guardrail.scopes).toContain('read:agent_output');
  });

  it('cada agente tiene version v1', () => {
    for (const agent of Object.values(AGENT_IDENTITIES)) {
      expect(agent.version).toBe('v1');
    }
  });
});
