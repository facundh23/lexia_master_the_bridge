import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { createDb, schema } from '../packages/db/src/index.js';
import { isNull, lte, and, eq } from 'drizzle-orm';

const db = createDb(
  process.env.DATABASE_URL ?? 'postgresql://lexia:lexia@localhost:5432/lexia_dev',
);

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'localhost',
  port: Number(process.env.SMTP_PORT ?? '1025'),
  secure: false,
  tls: { rejectUnauthorized: false },
});

async function processReminders() {
  const now = new Date();
  const dueReminders = await db
    .select({
      id: schema.reminders.id,
      userId: schema.reminders.userId,
      templateSlug: schema.reminders.templateSlug,
      scheduledFor: schema.reminders.scheduledFor,
    })
    .from(schema.reminders)
    .where(and(lte(schema.reminders.scheduledFor, now), isNull(schema.reminders.notifiedAt)));

  console.log(`[reminder-worker] ${dueReminders.length} recordatorios pendientes`);

  for (const reminder of dueReminders) {
    try {
      const [user] = await db
        .select({ email: schema.users.email, name: schema.users.name })
        .from(schema.users)
        .where(eq(schema.users.id, reminder.userId));

      if (!user?.email) {
        console.warn(`[reminder-worker] Usuario ${reminder.userId} sin email`);
        continue;
      }

      await mailer.sendMail({
        from: process.env.SMTP_FROM ?? 'Lexia <no-reply@lexia.app>',
        to: user.email,
        subject: `Recordatorio Lexia: ${reminder.templateSlug.replace(/_/g, ' ')}`,
        text: `Hola${user.name ? ` ${user.name}` : ''},\n\nTe recordamos que tienes una tarea pendiente relacionada con tu proceso de nacionalidad: ${reminder.templateSlug}.\n\nFecha programada: ${reminder.scheduledFor.toLocaleDateString('es-ES')}\n\nEntra en Lexia para más información.\n\n---\nℹ️ Lexia es un asistente informativo. NO sustituye el asesoramiento jurídico de un abogado.`,
        html: `<p>Hola${user.name ? ` <strong>${user.name}</strong>` : ''},</p><p>Te recordamos que tienes una tarea pendiente: <strong>${reminder.templateSlug.replace(/_/g, ' ')}</strong>.</p><p>Fecha programada: ${reminder.scheduledFor.toLocaleDateString('es-ES')}</p><p><a href="${process.env.WEB_URL ?? 'http://localhost:3000'}">Entrar en Lexia</a></p><hr><p><small>ℹ️ Lexia es un asistente informativo. NO sustituye el asesoramiento jurídico de un abogado o gestor habilitado.</small></p>`,
      });

      await db
        .update(schema.reminders)
        .set({ notifiedAt: new Date() })
        .where(eq(schema.reminders.id, reminder.id));

      console.log(`[reminder-worker] Email enviado a ${user.email} (reminder ${reminder.id})`);
    } catch (err) {
      console.error(`[reminder-worker] Error procesando reminder ${reminder.id}:`, err);
    }
  }
}

// Run immediately on start, then every hour
processReminders().catch(console.error);

cron.schedule('0 * * * *', () => {
  processReminders().catch(console.error);
});

console.log('[reminder-worker] Iniciado. Procesando recordatorios cada hora.');
