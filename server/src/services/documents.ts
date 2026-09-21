import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS, formatDate, formatDateTime, fullName } from '../lib/labels.js';
import type { RequestDetailed } from './requests.js';

export interface GeneratedDocument {
  fileName: string;
  content: string;
}

export function buildRequestDocument(request: RequestDetailed): GeneratedDocument {
  const lines: string[] = [];
  lines.push(`ЗАЯВКА № ${request.id}`);
  lines.push('='.repeat(40));
  lines.push(`Дата создания: ${formatDateTime(request.createdAt)}`);
  lines.push(`Дом: ${request.house.address}`);
  lines.push(`Категория: ${CATEGORY_LABELS[request.category]}`);
  lines.push(`Приоритет: ${PRIORITY_LABELS[request.priority]}`);
  lines.push(`Автор: ${fullName(request.author)}${request.author.apartment ? `, кв. ${request.author.apartment}` : ''}`);
  lines.push(`Тема: ${request.title}`);
  lines.push('');
  lines.push('Описание проблемы:');
  lines.push(request.description);
  lines.push('');
  if (request.priority === 'EMERGENCY') {
    lines.push('Аварийная заявка: передана в УК без сбора подписей.');
  } else {
    lines.push(`Срок сбора подписей: ${request.deadline ? formatDate(request.deadline) : '—'}`);
    lines.push(`Подписи: собрано ${request.votesCount} из ${request.votesRequired} необходимых`);
    if (request.votes.length > 0) {
      lines.push('Подписали:');
      request.votes.forEach((vote, index) => {
        const apt = vote.user.apartment ? `, кв. ${vote.user.apartment}` : '';
        lines.push(`  ${index + 1}. ${fullName(vote.user)}${apt} — ${formatDateTime(vote.createdAt)}`);
      });
    }
  }
  lines.push('');
  lines.push(`Текущий статус: ${STATUS_LABELS[request.status]}`);
  if (request.delegatedTo) {
    lines.push(`Передана в организацию: ${request.delegatedTo.name}${request.delegatedTo.email ? ` (${request.delegatedTo.email})` : ''}`);
  }
  lines.push('');
  lines.push('История статусов:');
  for (const entry of request.statusHistory) {
    const who = entry.changedBy ? fullName(entry.changedBy) : 'система';
    const from = entry.oldStatus ? `${STATUS_LABELS[entry.oldStatus]} → ` : '';
    lines.push(`  ${formatDateTime(entry.changedAt)}: ${from}${STATUS_LABELS[entry.newStatus]} (${who})${entry.comment ? ` — ${entry.comment}` : ''}`);
  }
  lines.push('');
  lines.push(`Сформировано ботом SmartCity ${formatDateTime(new Date())}`);
  return { fileName: `zayavka-${request.id}.txt`, content: lines.join('\n') };
}
