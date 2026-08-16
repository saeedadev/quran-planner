import { REST_DAY_PHRASE, type ComputeResult, type DayPlan, type PlanConfig } from '@shared/plan-types';

import { validatePlanConfig } from '@shared/plan-validation';

import { refExists } from './mushaf';

import { buildMemorizationSchedule } from './memorization';
import { buildSmallReviewSchedule } from './small-review';
import { buildGrandReviewSchedule } from './grand-review';

export function computePlan(config: PlanConfig): ComputeResult {
  validatePlanConfig(config, refExists);

  const memorization = buildMemorizationSchedule(config);
  const smallReview = buildSmallReviewSchedule(config, memorization);
  const grandReview = buildGrandReviewSchedule(config, memorization);

  const days: DayPlan[] = memorization.days.map((day, index) => ({
    date: day.date,
    kind: day.kind,
    newMemorization: day.newMemorization,
    smallReview: smallReview.days[index] ?? null,
    grandReview: grandReview.days[index] ?? null,
    phrase: day.kind === 'rest' ? REST_DAY_PHRASE : null,
  }));

  return {
    days,
    endRef: memorization.endRef,
    completedSurahs: memorization.completedSurahs,
    issues: memorization.issues,
  };
}
