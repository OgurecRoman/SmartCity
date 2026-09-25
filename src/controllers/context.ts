import type { Context, ScenarioController, ScenarioSession } from '@maxhub/max-bot-api';
import type { DbUser } from '../types/index.js';

export interface BotSession extends ScenarioSession {}

export type BotContext = Context & {
  session: BotSession;
  scenario: ScenarioController<BotContext>;

  dbUser: DbUser;
};
