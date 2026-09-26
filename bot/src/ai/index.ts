// import * as readline from 'node:readline/promises';
// import { AiModerator } from '../lib/aiModerator.js';
// import { ModerationDecision, Moderator } from './types.js';
// import dotenv from "dotenv";
// import { error } from 'node:console';

// dotenv.config();

// function applyConfidencePolicy(
//   decision: ModerationDecision,
//   blockMinConfidence: number
// ): ModerationDecision {
//   if (
//     decision.action === 'block' &&
//     decision.confidence < blockMinConfidence &&
//     !decision.categories.includes('error')
//   ) {
//     return {
//       ...decision,
//       action: 'warn',
//       reason: `Решение block понижено до warn из-за низкой уверенности. ${decision.reason}`,
//     };
//   }

//   return decision;
// }

// function printDecision(decision: ModerationDecision): void {
//   const labels: Record<ModerationDecision['action'], string> = {
//     allow: '✅ allow',
//     warn: '⚠️ warn',
//     block: '🚫 block',
//   };

//   const categories = decision.categories.length
//     ? decision.categories.join(', ')
//     : '-';

//   console.log(
//     `🤖 ${labels[decision.action]} | confidence=${decision.confidence.toFixed(
//       2
//     )} | categories=${categories}`
//   );

//   console.log(`   Причина: ${decision.reason}`);
// }

// async function startModerator(): Promise<void> {
//   const moderator = createModerator();

//   const maxWarnings = Number(process.env.MODERATION_MAX_WARNS ?? 2);

//   const blockMinConfidence = Number(
//     process.env.MODERATION_BLOCK_MIN_CONFIDENCE ?? 0.75
//   );

//   let blocked = false;
//   let warnings = 0;

//   const rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout,
//   });

//   while (true) {
//     let input: string;

//     try {
//       input = await rl.question('Вы > ');
//     } catch {
//       break;
//     }

//     const text = input.trim();

//     if (blocked) {
//       console.log(
//         '🚫 Вы заблокированы в тестовом чате. Введите /unblock, чтобы продолжить.'
//       );
//       continue;
//     }

//     const rawDecision = await moderator.moderate(text, 'Тестовый житель');
//     const decision = applyConfidencePolicy(rawDecision, blockMinConfidence);

//     printDecision(decision);

//     if (decision.action === 'block') {
//       blocked = true;
//       console.log('🚫 Пользователь заблокирован модератором.\n');
//       continue;
//     }

//     if (decision.action === 'warn') {
//       warnings += 1;
//       console.log(`⚠️ Предупреждение: ${warnings}/${maxWarnings}.`);

//       if (warnings >= maxWarnings) {
//         blocked = true;
//         console.log(
//           '🚫 Пользователь заблокирован после нескольких предупреждений.\n'
//         );
//       } else {
//         console.log('');
//       }

//       continue;
//     }

//     console.log('✅ Сообщение разрешено.\n');
//   }

//   rl.close();
// }