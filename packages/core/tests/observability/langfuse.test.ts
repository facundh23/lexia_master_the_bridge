import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockTraceUpdate = vi.fn();
const mockSpanEnd = vi.fn();
const mockTrace = vi.fn(() => ({
  update: mockTraceUpdate,
  span: vi.fn(() => ({ end: mockSpanEnd })),
}));

vi.mock('langfuse', () => ({
  Langfuse: vi.fn().mockImplementation(() => ({
    trace: mockTrace,
  })),
}));

import { startTrace } from '../../src/observability/langfuse.js';

describe('startTrace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('LANGFUSE_ENABLED', 'true');
    vi.stubEnv('LANGFUSE_PUBLIC_KEY', 'pk-test');
    vi.stubEnv('LANGFUSE_SECRET_KEY', 'sk-test');
  });

  it('crea el trace sin campo input (no manda contenido crudo al crearlo)', async () => {
    await startTrace({ userId: 'user-1', vertical: 'nacionalidad_residencia' });
    expect(mockTrace).toHaveBeenCalledWith(
      expect.not.objectContaining({ input: expect.anything() }),
    );
  });

  it('setInput manda el contenido vía trace.update, no en la creación', async () => {
    const trace = await startTrace({ userId: 'user-1', vertical: 'nacionalidad_residencia' });
    trace.setInput('mensaje sanitizado');
    expect(mockTraceUpdate).toHaveBeenCalledWith({ input: { content: 'mensaje sanitizado' } });
  });

  it('noopTrace (sin config de Langfuse) expone setInput sin romper', async () => {
    vi.stubEnv('LANGFUSE_ENABLED', 'false');
    const trace = await startTrace({ userId: 'user-1', vertical: 'nacionalidad_residencia' });
    expect(() => trace.setInput('cualquier texto')).not.toThrow();
    expect(mockTrace).not.toHaveBeenCalled();
  });

  it('end() sigue funcionando para el output (sin cambios de comportamiento)', async () => {
    const trace = await startTrace({ userId: 'user-1', vertical: 'nacionalidad_residencia' });
    trace.end({ response: 'resp', route: 'normativa', citations: [] });
    expect(mockTraceUpdate).toHaveBeenCalledWith({
      output: { response: 'resp', route: 'normativa', citations: [] },
    });
  });
});
