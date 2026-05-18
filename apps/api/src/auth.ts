import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createDb, schema } from '@lexia/db';
import { mailer } from './mailer.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) throw new Error('BETTER_AUTH_SECRET is required');

const db = createDb(databaseUrl);

const requireEmailVerification = process.env.NODE_ENV !== 'test';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      users: schema.users,
      sessions: schema.sessions,
      accounts: schema.accounts,
      verifications: schema.verifications,
    },
    usePlural: true,
  }),
  secret,
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:4000',
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    requireEmailVerification,
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }: any) => {
      await mailer.sendMail({
        from: process.env.SMTP_FROM ?? 'noreply@lexia.local',
        to: user.email,
        subject: 'Verificá tu email en Lexia',
        html: `<p>Hola ${user.name ?? user.email},</p>
               <p>Para verificar tu cuenta hacé clic aquí:</p>
               <p><a href="${url}">Verificar email</a></p>
               <p>El enlace expira en 24 horas.</p>
               <p><small>Si no creaste una cuenta en Lexia, ignorá este mensaje.</small></p>`,
      });
    },
    autoSignInAfterVerification: true,
  },
  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:4000',
    ...(process.env.TRUSTED_ORIGINS?.split(',') ?? []),
  ],
});
