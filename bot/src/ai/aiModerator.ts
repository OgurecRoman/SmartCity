import { ModerationDecision, Moderator } from './types.js';

export interface AiModeratorOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs?: number;
  failStrategy?: 'allow' | 'block';
  jsonMode?: boolean;
  systemPrompt?: string;
}

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const DEFAULT_SYSTEM_PROMPT = `Ты — автоматический модератор чата жителей многоквартирного дома.

Твоя задача: оценить одно сообщение участника и вернуть решение модерации в формате JSON.

Разрешено:
- обсуждение вопросов дома: лифт, уборка, парковка, ЖКХ, собрание собственников, шум, ремонт;
- вежливая критика и претензии без перехода на личности;
- просьбы, объявления по делу, нейтральные комментарии.

Запрещено и должно получать action=block:
- оскорбления, унижения, травля, угрозы, пожелания вреда людям;
- разжигание ненависти по национальному, религиозному, политическому или иному признаку;
- призывы к насилию, экстремизму, незаконным действиям;
- явная пропаганда/агитация, не относящаяся к дому: политическая, религиозная, идеологическая, реклама кандидатов, митингов, движений, петиций, сборов, если это не согласовано администрацией чата;
- спам, мошенничество, фишинг.

Если сомневаешься, сообщение грубое, но не нарушает явно, или похож конфликт без прямых оскорблений, используй action=warn.

Не блокируй только за критику УК, соседей, администрации дома, если нет оскорблений, угроз, травли или агитации.

Верни строго один валидный JSON-объект без markdown и без текста вокруг:
{"action":"allow|warn|block","categories":["insult","threat","harassment","hate","propaganda","spam","fraud","other"],"confidence":0.0,"reason":"краткая причина на русском"}

Поле confidence — число от 0 до 1.
Поле categories — массив подходящих категорий, можно пустой для allow.`;

export class AiModerator implements Moderator {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly failStrategy: 'allow' | 'block';
  private readonly jsonMode: boolean;
  private readonly systemPrompt: string;

  constructor(options: AiModeratorOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.model = options.model;
    this.timeoutMs = options.timeoutMs ?? 20000;
    this.failStrategy = options.failStrategy ?? 'allow';
    this.jsonMode = options.jsonMode ?? true;
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  }

  async moderate(message: string, author: string): Promise<ModerationDecision> {
    const trimmed = message.trim();

    if (!trimmed) {
      return {
        action: 'allow',
        categories: ['empty'],
        confidence: 1,
        reason: 'Пустое сообщение',
      };
    }

    try {
      const userContent = JSON.stringify(
        {
          author,
          message: trimmed,
        },
        null,
        0
      );

      const completion = await this.requestCompletion([
        {
          role: 'system',
          content: this.systemPrompt,
        },
        {
          role: 'user',
          content: `Оцени сообщение жителя чата дома и верни только JSON.\nДанные: ${userContent}`,
        },
      ]);

      return parseDecision(completion);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      const reason = `Ошибка AI-модерации: ${errorMessage}`;

      if (this.failStrategy === 'block') {
        return {
          action: 'block',
          categories: ['error'],
          confidence: 0,
          reason,
          raw: null,
        };
      }

      return {
        action: 'allow',
        categories: ['error'],
        confidence: 0,
        reason,
        raw: null,
      };
    }
  }

  private async requestCompletion(messages: ChatMessage[]): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`;

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };

    const baseBody = {
      model: this.model,
      temperature: 0,
      max_tokens: 500,
      messages,
    };

    const runFetch = async (body: object) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        return await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`Таймаут запроса к модели (${this.timeoutMs} ms)`);
        }

        throw error;
      } finally {
        clearTimeout(timer);
      }
    };

    let response = await runFetch(
      this.jsonMode
        ? {
            ...baseBody,
            response_format: {
              type: 'json_object',
            },
          }
        : baseBody
    );

    if (!response.ok) {
      const firstError = await response.text().catch(() => '');

      const maybeJsonModeIssue =
        this.jsonMode &&
        [400, 404, 422].includes(response.status) &&
        /response_format|json_object|json_schema|unsupported/i.test(firstError);

      if (maybeJsonModeIssue) {
        response = await runFetch(baseBody);

        if (!response.ok) {
          const retryError = await response.text().catch(() => '');
          throw new Error(
            `HTTP ${response.status}: ${retryError || firstError}`
          );
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${firstError}`);
      }
    }

    const data = (await response.json()) as any;
    const content = data?.choices?.[0]?.message?.content;

    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('Пустой ответ от модели');
    }

    return content;
  }
}

function parseDecision(rawModelOutput: string): ModerationDecision {
  const jsonString = extractJson(rawModelOutput);

  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error(
      `Ответ модели не является JSON: ${rawModelOutput.slice(0, 300)}`
    );
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

  const reason =
    typeof raw.reason === 'string'
      ? raw.reason.trim()
      : 'Причина не указана';

  return {
    action,
    categories,
    confidence,
    reason,
    raw,
  };
}