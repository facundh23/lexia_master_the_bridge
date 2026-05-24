declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    userEmail?: string;
  }
}
