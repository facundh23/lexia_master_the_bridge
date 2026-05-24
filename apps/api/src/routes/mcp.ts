import type { FastifyPluginAsync } from 'fastify';
import { createDb, schema } from '@lexia/db';
import { runNormativaAgent, computeEligibility, nacionalidadResidencia } from '@lexia/core';
import { requirePat } from '../middleware/requirePat.js';
import { requireProfessional } from '../middleware/requireProfessional.js';
import type { VerticalDefinition } from '@lexia/core';

const db = createDb(process.env.DATABASE_URL ?? '');

// Helper: audit log con surface='mcp' en cada request
// Ver justificación DEC-6: non-repudiation + segregación de surfaces para compliance
async function logMcpAction(
  userId: string,
  action: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(schema.auditLog).values({
      actorType: 'user',
      actorId: userId,
      surface: 'mcp',
      action,
      details: details ?? {},
    });
  } catch {
    // fail-open: no interrumpir el request si audit log falla
  }
}

const VERTICAL_MANIFESTS: Record<string, VerticalDefinition> = {
  nacionalidad_residencia: nacionalidadResidencia,
};

export const mcpRoute: FastifyPluginAsync = async (app) => {
  const auth = { preHandler: [requirePat, requireProfessional] };

  // Tool: search_corpus_with_citations
  app.post('/api/mcp/search', auth, async (request, reply) => {
    const body = request.body as {
      query?: string;
      vertical?: string;
      conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
    } | null;

    const query = body?.query?.trim();
    if (!query) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'query es requerido' });
    }

    const vertical = body?.vertical ?? 'nacionalidad_residencia';

    const result = await runNormativaAgent({
      content: query,
      conversationHistory: body?.conversationHistory ?? [],
      userId: request.userId,
      vertical,
    });

    await logMcpAction(request.userId, 'mcp_search', {
      vertical,
      citationsCount: result.citations.length,
    });

    return { ...result, surface: 'mcp' };
  });

  // Tool: compute_eligibility
  app.post('/api/mcp/eligibility', auth, async (request) => {
    const body = request.body as {
      countryOrigin?: string;
      arrivalDate?: string;
      residenceStatus?: string;
    } | null;

    const result = computeEligibility({
      countryOrigin: body?.countryOrigin,
      arrivalDate: body?.arrivalDate,
      residenceStatus: body?.residenceStatus,
    });

    await logMcpAction(request.userId, 'mcp_eligibility', {
      specialCase: result.specialCase,
      isEligible: result.isEligible,
    });

    return { ...result, surface: 'mcp' };
  });

  // Tool: get_procedure_requirements
  app.get('/api/mcp/procedure/:vertical/requirements', auth, async (request, reply) => {
    const { vertical } = request.params as { vertical: string };

    const manifest = VERTICAL_MANIFESTS[vertical];
    if (!manifest) {
      return reply
        .status(404)
        .send({ error: 'NOT_FOUND', message: `Vertical '${vertical}' no encontrado` });
    }

    await logMcpAction(request.userId, 'mcp_requirements', { vertical });

    return {
      surface: 'mcp',
      vertical: manifest.slug,
      name: manifest.name,
      requirements: {
        intakeFields: manifest.intake.fields,
        corpusSources: manifest.corpus.sources,
        reminders: manifest.reminders,
      },
    };
  });
};
