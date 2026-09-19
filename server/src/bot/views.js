import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { buildRequestDocument } from '../services/documents.js';
import { getRequest, getRequestDetailed, hasVoted } from '../services/requests.js';

import { panelButton, requestCard, residentRequestButtons, ukRequestButtons, withKeyboard } from './ui.js';

export async function showRequestToResident(ctx, requestId) {
  const request = await getRequest(requestId);
  if (!request) {
    await ctx.reply('Заявка не найдена — возможно, её удалили.', withKeyboard(panelButton()));
    return;
  }
  const voted = await hasVoted(request.id, ctx.dbUser.id);
  const text = requestCard(request) + (voted ? '\n\n✅ Вы поддержали эту заявку' : '');
  await ctx.reply(text, withKeyboard([...residentRequestButtons(request, ctx.dbUser, voted), ...panelButton()]));
}

export async function showRequestToEmployee(ctx, requestId) {
  const request = await getRequest(requestId);
  if (!request) {
    await ctx.reply('Заявка не найдена — возможно, её удалили.', withKeyboard(panelButton()));
    return;
  }
  await ctx.reply(requestCard(request), withKeyboard([...ukRequestButtons(request), ...panelButton()]));
}

const LIST_LIMIT = 10;

export async function sendRequestList(ctx, requests, title, buttonsFor) {
  if (requests.length === 0) {
    await ctx.reply(`${title}: пока пусто.`, withKeyboard(panelButton()));
    return;
  }
  await ctx.reply(`${title} (${requests.length}):`);
  for (const request of requests.slice(0, LIST_LIMIT)) {
    const rows = buttonsFor(request);
    await ctx.reply(requestCard(request), rows.length > 0 ? withKeyboard(rows) : undefined);
  }
  const tail = requests.length > LIST_LIMIT ? `Показаны первые ${LIST_LIMIT} из ${requests.length}. ` : '';
  await ctx.reply(`${tail}Что дальше?`, withKeyboard(panelButton()));
}

/** Формирует текстовый документ по заявке и отправляет его файлом в текущий чат. */
export async function sendRequestDocument(ctx, requestId) {
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
    // Загруженный файл становится доступен для отправки не мгновенно — пробуем несколько раз
    let lastError;
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
