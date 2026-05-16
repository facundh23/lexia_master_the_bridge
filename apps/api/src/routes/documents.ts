import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { createDb, schema } from '@lexia/db';
import { createMinioClient } from '@lexia/core/storage';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

const db = createDb(process.env.DATABASE_URL ?? '');
const minio = createMinioClient();
const BUCKET = process.env.MINIO_BUCKET ?? 'lexia-uploads';

export const documentsRoute: FastifyPluginAsync = async (app) => {
  app.post(
    '/api/documents/upload',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const data = await request.file();
      if (!data) return reply.status(400).send({ error: 'NO_FILE' });

      const ext = data.filename.split('.').pop() ?? 'bin';
      const minioKey = `${request.userId}/${randomUUID()}.${ext}`;
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);

      await minio.putObject(BUCKET, minioKey, buffer, buffer.length, {
        'Content-Type': data.mimetype,
      });

      const [doc] = await db
        .insert(schema.documents)
        .values({
          userId: request.userId,
          filename: data.filename,
          minioKey,
          status: 'pending',
          sizeBytes: buffer.length,
          mimeType: data.mimetype,
        })
        .returning();

      return reply.status(201).send(doc);
    },
  );

  app.get('/api/documents', { preHandler: [requireAuth] }, async (request) => {
    return db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.userId, request.userId))
      .orderBy(schema.documents.createdAt);
  });
};
