import * as readline from 'node:readline/promises';
import { AiModerator } from './aiModerator.js';
import { ModerationDecision, Moderator } from './types.js';
import dotenv from "dotenv";
import { error } from 'node:console';

dotenv.config();

function createModerator(): Moderator {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  const baseUrl = (
    process.env.MODERATION_BASE_URL?.trim() || 'https://api.openai.com/v1'
  ).replace(/\/+$/, '');

  const model =
    process.env.MODERATION_MODEL?.trim() || 'gpt-4o-mini';

  const timeoutMs = Number(process.env.MODERATION_TIMEOUT_MS ?? 20000);

  const failStrategy =
    process.env.MODERATION_FAIL_STRATEGY === 'block' ? 'block' : 'allow';

  const jsonMode = process.env.MODERATION_JSON_MODE !== 'false';

  if (!apiKey) {
    throw error('⚠️ OPENAI_API_KEY не задан');
  }

  console.log(`ℹ️ AI-модерация: ${baseUrl}, model=${model}`);

  return new AiModerator({
    apiKey,
    baseUrl,
    model,
    timeoutMs,
    failStrategy,
    jsonMode,
  });
}

function applyConfidencePolicy(
  decision: ModerationDecision,
  blockMinConfidence: number
): ModerationDecision {
  if (
    decision.action === 'block' &&
    decision.confidence < blockMinConfidence &&
    !decision.categories.includes('error')
  ) {
    return {
      ...decision,
      action: 'warn',
      reason: `Решение block понижено до warn из-за низкой уверенности. ${decision.reason}`,
    };
  }

  return decision;
}

function printDecision(decision: ModerationDecision): void {
  const labels: Record<ModerationDecision['action'], string> = {
    allow: '✅ allow',
    warn: '⚠️ warn',
    block: '🚫 block',
  };

  const categories = decision.categories.length
    ? decision.categories.join(', ')
    : '-';

  console.log(
    `🤖 ${labels[decision.action]} | confidence=${decision.confidence.toFixed(
      2
    )} | categories=${categories}`
  );

  console.log(`   Причина: ${decision.reason}`);
}

function printHelp(): void {
  console.log(
    [
      'Команды:',
      '/help — помощь',
      '/status — текущий статус пользователя',
      '/unblock — снять тестовую блокировку',
      '/exit — выход',
      'Любой другой текст отправляется на модерацию.',
    ].join('\n')
  );
}

async function main(): Promise<void> {
  const moderator = createModerator();

  const maxWarnings = Number(process.env.MODERATION_MAX_WARNS ?? 2);

  const blockMinConfidence = Number(
    process.env.MODERATION_BLOCK_MIN_CONFIDENCE ?? 0.75
  );

  let blocked = false;
  let warnings = 0;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  process.on('SIGINT', () => {
    console.log('\nВыход.');
    rl.close();
    process.exit(0);
  });

  console.log('Консольный тест модерации чата дома.');
  console.log('Введите /help для списка команд.\n');

  while (true) {
    let input: string;

    try {
      input = await rl.question('Вы > ');
    } catch {
      break;
    }

    const text = input.trim();

    if (!text) {
      continue;
    }

    if (text === '/exit' || text === '/quit') {
      break;
    }

    if (text === '/help') {
      printHelp();
      continue;
    }

    if (text === '/status') {
      console.log(
        `Статус: ${
          blocked ? 'заблокирован' : 'активен'
        }, предупреждений: ${warnings}/${maxWarnings}`
      );
      continue;
    }

    if (text === '/unblock') {
      blocked = false;
      warnings = 0;
      console.log('🔓 Тестовая блокировка снята.');
      continue;
    }

    if (blocked) {
      console.log(
        '🚫 Вы заблокированы в тестовом чате. Введите /unblock, чтобы продолжить.'
      );
      continue;
    }

    const rawDecision = await moderator.moderate(text, 'Тестовый житель');
    const decision = applyConfidencePolicy(rawDecision, blockMinConfidence);

    printDecision(decision);

    if (decision.action === 'block') {
      blocked = true;
      console.log('🚫 Пользователь заблокирован модератором.\n');
      continue;
    }

    if (decision.action === 'warn') {
      warnings += 1;
      console.log(`⚠️ Предупреждение: ${warnings}/${maxWarnings}.`);

      if (warnings >= maxWarnings) {
        blocked = true;
        console.log(
          '🚫 Пользователь заблокирован после нескольких предупреждений.\n'
        );
      } else {
        console.log('');
      }

      continue;
    }

    console.log('✅ Сообщение разрешено.\n');
  }

  rl.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});