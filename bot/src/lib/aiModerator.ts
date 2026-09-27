import * as crypto from 'crypto';
import { ModerationDecision, Moderator } from '../types/ai.js';
import { DEFAULT_SYSTEM_PROMPT } from '../scripts/prompt.js';

export interface AiModeratorOptions {
  authKey?: string;
  clientId?: string;
  clientSecret?: string;
  authUrl?: string;
  chatUrl?: string;
  model?: string;
  timeoutMs?: number;
  failStrategy?: 'allow' | 'block';
  scope?: string;
}

class GigaChatAuth {
  private basicAuthString: string;
  private authUrl: string;
  private scope: string;
  
  private token: string | null = null;
  private expiresAt: number = 0;

  constructor(basicAuthString: string, authUrl: string, scope: string) {
    this.basicAuthString = basicAuthString;
    this.authUrl = authUrl;
    this.scope = scope;
  }

  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.expiresAt - 60000) {
      return this.token;
    }

    const rqUid = crypto.randomUUID();

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'RqUID': `${rqUid}`,
      'Authorization': `Basic ${this.basicAuthString}`
    };

    const body = new URLSearchParams({
      scope: this.scope
    });
    
    const response = await fetch(this.authUrl, {
      method: 'POST',
      headers: headers,
      body: body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GigaChat auth failed: ${response.status} ${response.statusText}. Details: ${errorText}`);
    }

    const data = await response.json() as { access_token: string; expires_at: number };
    
    this.token = data.access_token;
    this.expiresAt = data.expires_at * 1000; 
    
    return this.token;
  }
}

export class AiModerator implements Moderator {
  private readonly auth: GigaChatAuth;
  private readonly model: string;
  private readonly failStrategy: 'allow' | 'block';
  private readonly systemPrompt: string;
  private readonly chatUrl: string;
  private readonly timeoutMs: number;

  constructor(options: AiModeratorOptions) {
    const basicAuthString = options.authKey 
      ? options.authKey 
      : Buffer.from(`${options.clientId}:${options.clientSecret}`).toString('base64');

    this.auth = new GigaChatAuth(
      basicAuthString,
      options.authUrl || 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
      options.scope || 'GIGACHAT_API_PERS'
    );

    this.model = options.model || 'GigaChat';
    this.failStrategy = options.failStrategy ?? 'allow';
    this.systemPrompt = DEFAULT_SYSTEM_PROMPT;
    this.timeoutMs = options.timeoutMs ?? 20000;
    this.chatUrl = options.chatUrl || 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';
  }

  async moderate(message: string, author: string): Promise<ModerationDecision> {
    const trimmed = message.trim();

    if (!trimmed) {
      return {
        action: 'allow',
        categories: ['empty'],
        confidence: 1,
        is_complaint_to_uk: false,
        reason: 'Пустое сообщение',
      };
    }

    try {
      const token = await this.auth.getToken();
      const userContent = JSON.stringify({ author, message: trimmed }, null, 0);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(this.chatUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          max_tokens: 500,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: this.systemPrompt,
            },
            {
              role: 'user',
              content: `Оцени сообщение жителя чата дома и верни только JSON.\nДанные: ${userContent}`,
            },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GigaChat API error: ${response.status} ${response.statusText}. Details: ${errorText}`);
      }

      const data = await response.json();
      const content = (data as any).choices?.[0]?.message?.content;

      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new Error('Пустой ответ от модели');
      }

      return parseDecision(content);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const reason = `Ошибка AI-модерации: ${errorMessage}`;

      if (this.failStrategy === 'block') {
        return {
          action: 'block',
          categories: ['error'],
          confidence: 0,
          reason,
          is_complaint_to_uk: false,
          raw: null,
        };
      }

      return {
        action: 'allow',
        categories: ['error'],
        confidence: 0,
        is_complaint_to_uk: false,
        reason,
        raw: null,
      };
    }
  }
}

function parseDecision(rawModelOutput: string): ModerationDecision {
  const jsonString = extractJson(rawModelOutput);
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error(`Ответ модели не является JSON: ${rawModelOutput.slice(0, 300)}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Ответ модели не является JSON-объектом');
  }

  return normalizeDecision(parsed as Record<string, unknown>);
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }

  return text.trim();
}

function normalizeDecision(raw: Record<string, unknown>): ModerationDecision {
  const actionValue = String(raw.action ?? '').toLowerCase();

  const action = (
    actionValue === 'block' || actionValue === 'warn'
      ? actionValue
      : 'allow'
  ) as ModerationDecision['action'];

  const categories = Array.isArray(raw.categories)
    ? raw.categories.map((item) => String(item))
    : [];

  const confidenceNumber = Number(raw.confidence);
  const confidence = Number.isFinite(confidenceNumber)
    ? Math.min(1, Math.max(0, confidenceNumber))
    : 0.5;

  const is_complaint_to_uk = Boolean(raw.is_complaint_to_uk);

  const reason = typeof raw.reason === 'string' ? raw.reason.trim() : 'Причина не указана';

  return {
    action,
    categories,
    confidence,
    reason,
    is_complaint_to_uk,
    raw,
  };
}

function createModerator(): Moderator {
  const authKey = process.env.GIGACHAT_AUTH_KEY;
  const clientId = process.env.GIGACHAT_CLIENT_ID;
  const clientSecret = process.env.GIGACHAT_CLIENT_SECRET;

  if (!authKey && (!clientId || !clientSecret)) {
    throw new Error('⚠️ Задайте в .env либо GIGACHAT_AUTH_KEY, либо пару GIGACHAT_CLIENT_ID и GIGACHAT_CLIENT_SECRET');
  }

  const model = process.env.GIGACHAT_MODEL?.trim() || 'GigaChat';
  const scope = process.env.GIGACHAT_SCOPE?.trim() || 'GIGACHAT_API_PERS';
  const timeoutMs = Number(process.env.MODERATION_TIMEOUT_MS ?? 20000);
  const failStrategy = process.env.MODERATION_FAIL_STRATEGY === 'block' ? 'block' : 'allow';

  console.log(`ℹ️ AI-модерация GigaChat: model=${model}, scope=${scope}`);

  return new AiModerator({
    authKey,
    clientId,
    clientSecret,
    model,
    scope,
    timeoutMs,
    failStrategy,
  });
}

export const moderator = createModerator();