import nodemailer from 'nodemailer';

export const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'localhost',
  port: Number(process.env.SMTP_PORT ?? '1025'),
  secure: false,
  tls: { rejectUnauthorized: false },
});
