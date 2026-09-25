export type ModerationAction = 'allow' | 'warn' | 'block';

export interface ModerationDecision {
  action: ModerationAction;
  categories: string[];
  confidence: number;
  reason: string;
  raw?: unknown;
}

export interface Moderator {
  moderate(message: string, author: string): Promise<ModerationDecision>;
}