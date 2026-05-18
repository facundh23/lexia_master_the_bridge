import { randomUUID } from 'node:crypto';

type LangfuseClient = import('langfuse').Langfuse;

export interface TraceHandle {
  traceId: string;
  span(name: string): SpanHandle;
  end(output: { response: string; route: string; citations: string[] }): void;
}

export interface SpanHandle {
  end(output: unknown): void;
}

const NOOP_SPAN: SpanHandle = { end: () => {} };

function noopTrace(traceId: string): TraceHandle {
  return {
    traceId,
    span: () => NOOP_SPAN,
    end: () => {},
  };
}

let _langfuse: LangfuseClient | null = null;

async function getLangfuse(): Promise<LangfuseClient | null> {
  if (process.env.LANGFUSE_ENABLED === 'false') return null;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  if (!publicKey || !secretKey) return null;

  if (!_langfuse) {
    const { Langfuse } = await import('langfuse');
    _langfuse = new Langfuse({
      publicKey,
      secretKey,
      baseUrl: process.env.LANGFUSE_BASEURL ?? 'http://localhost:3001',
      flushAt: 1,
    });
  }
  return _langfuse;
}

export async function startTrace(input: {
  userId: string;
  content: string;
  vertical: string;
}): Promise<TraceHandle> {
  const traceId = randomUUID();
  const lf = await getLangfuse();

  if (!lf) return noopTrace(traceId);

  const trace = lf.trace({
    id: traceId,
    name: 'lexia-core',
    userId: input.userId,
    input: { content: input.content },
    metadata: { vertical: input.vertical },
  });

  return {
    traceId,
    span(name: string): SpanHandle {
      const span = trace.span({ name, input: { name } });
      return { end: (output: unknown) => span.end({ output }) };
    },
    end(output: { response: string; route: string; citations: string[] }) {
      trace.update({ output });
    },
  };
}
