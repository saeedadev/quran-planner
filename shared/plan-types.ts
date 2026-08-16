import type { AyahRef } from './types';

export const WEEK_LENGTH = 7;
export const MAX_PLAN_DAYS = 730;

export type PlanKind = 'closed' | 'open';
export type PlanDirection = 'forward' | 'reverse';
export type DayKind = 'study' | 'tathbeet' | 'companion' | 'rest';

export type Rate =
  | { readonly type: 'half-page' }
  | { readonly type: 'full-page' }
  | { readonly type: 'ayahs'; readonly count: number };

export interface GrandReviewConfig {
  readonly ayahsPerRound: number;
}

export type PlanConfig =
  | {
      readonly kind: 'closed';
      readonly direction: PlanDirection;
      readonly startRef: AyahRef;
      readonly rate: Rate;
      readonly weeklyPattern: readonly DayKind[];
      readonly grandReview: GrandReviewConfig;
      readonly dates: { readonly start: string; readonly end: string };
    }
  | {
      readonly kind: 'open';
      readonly direction: PlanDirection;
      readonly startRef: AyahRef;
      readonly rate: Rate;
      readonly weeklyPattern: readonly DayKind[];
      readonly grandReview: GrandReviewConfig;
      readonly weeks: number;
      readonly startDate: string;
    };

export interface PlanRange {
  readonly from: AyahRef;
  readonly to: AyahRef;
}

export interface DayPlan {
  readonly date: string;
  readonly kind: DayKind;
  readonly newMemorization: PlanRange | null;
  readonly smallReview: PlanRange | null;
  readonly grandReview: PlanRange | null;
  readonly phrase: string | null;
}

export interface ComputeResult {
  readonly days: readonly DayPlan[];
  readonly endRef: AyahRef;
  readonly completedSurahs: readonly number[];
  readonly issues: readonly string[];
}

export const REST_DAY_PHRASE =
  'قال النبي ﷺ: "تَعَاهَدُوا هذا القُرْآنَ، فَوَالذي نَفْسُ مُحَمَّدٍ بِيَدِهِ لَهُوَ أشَدُّ تَفَلُّتاً مِنَ الإِبِلِ في عُقُلِهَا"';
