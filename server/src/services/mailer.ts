import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { log } from '../lib/logger.js';
import type { GeneratedDocument } from './documents.js';
import type { RequestWithRelations } from './requests.js';

export interface MailResult {
  simulated: boolean;
  to: string | null;
}

export function isMailConfigured(): boolean {
  return config.smtp.host.length > 0;
}

export async function sendDelegationEmail(
  request: RequestWithRelations,
  organization: { name: string; email: string | null },
  document: GeneratedDocument,
): Promise<MailResult> {
  const subject = `Заявка №${request.id}: ${request.title}`;
  if (!organization.email) {
    log.warn(`У организации «${organization.name}» нет email, письмо по заявке №${request.id} не отправлено`);
    return { simulated: true, to: null };
  }
  if (!isMailConfigured()) {
    log.info(`[ИМИТАЦИЯ ПОЧТЫ] Кому: ${organization.email}; Тема: ${subject}\n${document.content}`);
    return { simulated: true, to: organization.email };
  }
  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  await transport.sendMail({
    from: config.smtp.from,
    to: organization.email,
    subject,
    text: document.content,
    attachments: [{ filename: document.fileName, content: document.content }],
  });
  log.info(`Письмо по заявке №${request.id} отправлено в «${organization.name}» (${organization.email})`);
  return { simulated: false, to: organization.email };
}
