import { initialAgendaJob, MONDAY_JOB_KEY } from './agenda-2027';
import { initialNumerathumJob, NUMERATHUM_JOB_KEY } from './numerathum';
import type { MondayJob, MondayOrder, MondayItem, MondayJobOptions } from './shared';

export const MONDAY_DEFINITIONS = [
  { key: MONDAY_JOB_KEY, envPrefix: 'MONDAY_AGENDA_2027', initial: initialAgendaJob },
  { key: NUMERATHUM_JOB_KEY, envPrefix: 'MONDAY_NUMERATHUM', initial: initialNumerathumJob },
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
