import { initialAgendaJob, MONDAY_JOB_KEY } from './agenda-2027';
import { initialAgenda2026Job, MONDAY_AGENDA_2026_JOB_KEY } from './agenda-2026';
import { initialNumerathumJob, MONDAY_NUMERATHUM_PLANS, numerathumProductId } from './numerathum';
import { initialLibroJob, LIBRO_JOB_KEY } from './libro';
import { initialArithmaxJob, MONDAY_ARITHMAX_LICENSES, arithmaxProductId } from './arithmax';
import { initialCourseJob, MONDAY_COURSES } from './courses';
import { initialReportJob, MONDAY_REPORTS } from './reports';
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
  ...MONDAY_ARITHMAX_LICENSES.map((license) => ({
    key: license.jobKey,
    envPrefix: 'MONDAY_ARITHMAX',
    initial: (order: MondayOrder, items: MondayItem[], options: MondayJobOptions = {}) =>
      initialArithmaxJob(order, items, options, arithmaxProductId(license)),
  })),
  ...MONDAY_COURSES.map((course) => ({
    key: `mondayCourse${course.key}` as const,
    envPrefix: 'MONDAY_COURSES',
    initial: (order: MondayOrder, items: MondayItem[], options: MondayJobOptions = {}) =>
      initialCourseJob(order, items, options, course),
  })),
  ...MONDAY_REPORTS.map((report) => ({
    key: `mondayReport${report.key}` as const,
    envPrefix: 'MONDAY_REPORTS',
    initial: (order: MondayOrder, items: MondayItem[], options: MondayJobOptions = {}) =>
      initialReportJob(order, items, options, report),
  })),
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
