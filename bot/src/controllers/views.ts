import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { buildRequestDocument } from '../services/documents.js';
import { getRequest, getRequestDetailed, hasVoted, type RequestWithRelations } from '../services/requests.js';
import type { BotContext } from './context.js';
import { MD, panelButton, requestCard, residentRequestButtons, ukRequestButtons, withKeyboard, type ButtonRows } from './ui.js';

export async function showRequestToResident(ctx: BotContext, requestId: number): Promise<void> {
  const request = await getRequest(requestId);
  if (!request) {
    await ctx.reply('Заявка не найдена — возможно, её удалили.', withKeyboard(panelButton()));
    return;
  }
  const voted = await hasVoted(request.id, ctx.dbUser.id);
  const text = requestCard(request) + (voted ? '\n\n✅ Вы поддержали эту заявку' : '');
  await ctx.reply(text, { ...withKeyboard([...residentRequestButtons(request, ctx.dbUser, voted), ...panelButton()]), ...MD });
}

export async function showRequestToEmployee(ctx: BotContext, requestId: number): Promise<void> {
  const request = await getRequest(requestId);
  if (!request) {
    await ctx.reply('Заявка не найдена — возможно, её удалили.', withKeyboard(panelButton()));
    return;
  }
  await ctx.reply(requestCard(request), { ...withKeyboard([...ukRequestButtons(request), ...panelButton()]), ...MD });
}

const LIST_LIMIT = 10;

export async function sendRequestList(
  ctx: BotContext,
  requests: RequestWithRelations[],
  title: string,
  buttonsFor: (request: RequestWithRelations) => ButtonRows,
): Promise<void> {
  if (requests.length === 0) {
    await ctx.reply(`${title}: пока пусто.`, withKeyboard(panelButton()));
    return;
  }
  await ctx.reply(`${title} (${requests.length}):`);
  for (const request of requests.slice(0, LIST_LIMIT)) {
    const rows = buttonsFor(request);
    await ctx.reply(requestCard(request), rows.length > 0 ? { ...withKeyboard(rows), ...MD } : MD);
  }
  const tail = requests.length > LIST_LIMIT ? `Показаны первые ${LIST_LIMIT} из ${requests.length}. ` : '';
  await ctx.reply(`${tail}Что дальше?`, withKeyboard(panelButton()));
}

export async function sendRequestDocument(ctx: BotContext, requestId: number): Promise<void> {
  const request = await getRequestDetailed(requestId);
  if (!request) {
    await ctx.reply('Заявка не найдена.');
    return;
  }
  const document = buildRequestDocument(request);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'smartcity-'));
  const filePath = path.join(dir, document.fileName);
  try {
    await fs.writeFile(filePath, document.content, 'utf8');
    const file = await ctx.api.uploadFile({ source: filePath });

    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await ctx.reply(`📄 Документ по заявке №${request.id}`, { attachments: [file.toJson()] });
        return;
      } catch (error) {
        lastError = error;
        await sleep(1500);
      }
    }
    throw lastError;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
