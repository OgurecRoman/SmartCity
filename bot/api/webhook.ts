import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createBot, prepareBot } from '../src/controllers/index.js';
import { config } from '../src/config.js';
import { log } from '../src/lib/logger.js';

let bot: any = null;
let botInitialized = false;

async function getBot() {
  if (!botInitialized) {
    log.info('Инициализация бота для webhook...');
    bot = createBot();
    await prepareBot(bot);
    botInitialized = true;
    log.info('Бот успешно инициализирован');
  }
  return bot;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const startTime = Date.now();
  
  if (req.method === 'GET' && req.url?.includes('health')) {
    return res.status(200).json({ 
      status: 'ok', 
      botInitialized,
      timestamp: new Date().toISOString() 
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!req.body) {
    log.warn('Webhook received empty body');
    return res.status(400).json({ error: 'Empty request body' });
  }

  if (config.bot.webhookSecret) {
    const secret = req.headers['x-max-bot-api-secret'] 
                || req.headers['x-telegram-bot-api-secret-token']
                || req.headers['x-verification-token'];
    
    if (secret !== config.bot.webhookSecret) {
      log.warn('Invalid webhook secret received');
      return res.status(403).json({ error: 'Invalid secret' });
    }
  }

  try {
    const bot = await getBot();
    
    const updateType = req.body?.type || req.body?.message?.type || 'unknown';
    log.info(`Processing webhook update: ${updateType}`);
    if (typeof bot.handleUpdate === 'function') {
      await bot.handleUpdate(req.body);
    } else if (typeof bot.handleWebhook === 'function') {
      await bot.handleWebhook(req.body);
    } else {
      throw new Error('Bot instance has no handleUpdate or handleWebhook method');
    }
    
    const duration = Date.now() - startTime;
    log.info(`Webhook processed successfully in ${duration}ms`);
    
    return res.status(200).json({ ok: true, duration });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error(`Webhook processing failed after ${duration}ms:`, error);
    
    return res.status(200).json({ 
      ok: false, 
      error: 'Processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}