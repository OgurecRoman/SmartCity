import type { Request, Response } from 'express';
import { CATEGORY_LABELS, CATEGORY_ORDER, PRIORITY_LABELS, RESIDENT_TYPE_LABELS, STATUS_LABELS } from '../lib/labels.js';
import { STATUS_TRANSITIONS } from '../services/rules.js';

export function get(_req: Request, res: Response) {
  res.json({
    categories: CATEGORY_ORDER.map((value) => ({ value, label: CATEGORY_LABELS[value] })),
    statuses: (Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]).map((value) => ({ value, label: STATUS_LABELS[value] })),
    priorities: (Object.keys(PRIORITY_LABELS) as (keyof typeof PRIORITY_LABELS)[]).map((value) => ({ value, label: PRIORITY_LABELS[value] })),
    residentTypes: (Object.keys(RESIDENT_TYPE_LABELS) as (keyof typeof RESIDENT_TYPE_LABELS)[]).map((value) => ({
      value,
      label: RESIDENT_TYPE_LABELS[value],
    })),
    transitions: STATUS_TRANSITIONS,
  });
}
