import { initialAgendaJob, MONDAY_JOB_KEY } from './agenda-2027';
import { initialAgenda2026Job, MONDAY_AGENDA_2026_JOB_KEY } from './agenda-2026';
import { initialNumerathumJob, MONDAY_NUMERATHUM_PLANS, numerathumProductId } from './numerathum';
import { initialLibroJob, LIBRO_JOB_KEY } from './libro';
import type { MondayJob, MondayOrder, MondayItem, MondayJobOptions } from './shared';

export const MONDAY_DEFINITIONS = [
  { key: MONDAY_JOB_KEY, envPrefix: 'MONDAY_AGENDA_2027', initial: initialAgendaJob },
  { key: MONDAY_AGENDA_2026_JOB_KEY, envPrefix: 'MONDAY_AGENDA_2026', initial: initialAgenda2026Job },
  ...MONDAY_NUMERATHUM_PLANS.map((plan) => ({
    key: plan.jobKey,
    envPrefix: 'MONDAY_NUMERATHUM',
    initial: (order: MondayOrder, items: MondayItem[], options: MondayJobOptions = {}) =>
      initialNumerathumJob(order, items, options, numerathumProductId(plan)),
  })),
  { key: LIBRO_JOB_KEY, envPrefix: 'MONDAY_LIBRO', initial: initialLibroJob },
] as const;
export type MondayJobKey = typeof MONDAY_DEFINITIONS[number]['key'];

export function buildInitialMondayJobs(order: MondayOrder, items: MondayItem[], options: {
  [Key in MondayJobKey]?: MondayJobOptions;
} = {}): Partial<Record<MondayJobKey, MondayJob>> {
  const jobs: Partial<Record<MondayJobKey, MondayJob>> = {};
  for (const definition of MONDAY_DEFINITIONS) {
    const job = definition.initial(order, items, options[definition.key]);
    if (job) jobs[definition.key] = job;
  }
  return jobs;
}
