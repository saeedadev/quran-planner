import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import type { ComputeResult, DayKind, GrandReviewUnit, PlanConfig, PlanRange } from '@shared/plan-types';
import { PlanConfigError } from '@shared/plan-validation';

import { computePlan } from '../../src/engine/merge';
import { refExists, surahName } from '../../src/engine/mushaf';

const KIND_LABELS: Record<DayKind, string> = {
  study: 'دراسة',
  tathbeet: 'تثبيت',
  companion: 'مرافقة',
  rest: 'إجازة',
};

const DAY_OPTIONS: { value: DayKind; label: string }[] = [
  { value: 'study', label: 'يوم دراسي' },
  { value: 'tathbeet', label: 'يوم سرد تثبيت' },
  { value: 'companion', label: 'يوم سرد مرافقة' },
  { value: 'rest', label: 'يوم إجازة' },
];

type WeekdayKey = 'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri';

const WEEKDAY_KEYS: readonly WeekdayKey[] = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];

const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  sat: 'السبت',
  sun: 'الأحد',
  mon: 'الاثنين',
  tue: 'الثلاثاء',
  wed: 'الأربعاء',
  thu: 'الخميس',
  fri: 'الجمعة',
};

const JS_KEY_BY_NUMBER: readonly WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const DEFAULT_WEEK_DAYS: Record<WeekdayKey, DayKind> = {
  sat: 'rest',
  sun: 'study',
  mon: 'study',
  tue: 'study',
  wed: 'study',
  thu: 'tathbeet',
  fri: 'rest',
};

function weekdayNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

function buildPattern(weekDays: Record<WeekdayKey, DayKind>, startDate: string): readonly DayKind[] {
  const start = weekdayNumber(startDate);
  const pattern: DayKind[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    pattern.push(weekDays[JS_KEY_BY_NUMBER[(start + offset) % 7]]);
  }
  return pattern;
}

function fmtRange(range: PlanRange | null): string {
  if (!range) {
    return '—';
  }
  if (range.from.surah === range.to.surah) {
    return `${surahName(range.from.surah)} ${range.from.ayah} ← ${range.to.ayah}`;
  }
  return `${surahName(range.from.surah)} ${range.from.ayah} ← ${surahName(range.to.surah)} ${range.to.ayah}`;
}

function fmtRef(ref: { surah: number; ayah: number }): string {
  return `${surahName(ref.surah)} ${ref.ayah}`;
}

function allRefsOf(result: ComputeResult): { from: { surah: number; ayah: number }; to: { surah: number; ayah: number } }[] {
  const refs: { from: { surah: number; ayah: number }; to: { surah: number; ayah: number } }[] = [];
  for (const day of result.days) {
    for (const range of [day.newMemorization, day.smallReview, day.grandReview]) {
      if (range) {
        refs.push(range);
      }
    }
  }
  return refs;
}

const SURAH_OPTIONS: readonly number[] = Array.from({ length: 114 }, (_, index) => index + 1);

const GRAND_REVIEW_UNITS: { value: GrandReviewUnit; label: string }[] = [
  { value: 'ayahs', label: 'بالآيات' },
  { value: 'pages', label: 'بالصفحات' },
  { value: 'quarters', label: 'بالأرباع' },
  { value: 'ajza', label: 'بالأحزاب' },
];

function Sandbox() {
  const [kind, setKind] = useState<'closed' | 'open'>('closed');
  const [direction, setDirection] = useState<'forward' | 'reverse'>('forward');
  const [surah, setSurah] = useState('1');
  const [ayah, setAyah] = useState('1');
  const [rateType, setRateType] = useState<'half-page' | 'full-page' | 'ayahs'>('full-page');
  const [count, setCount] = useState('20');
  const [weekDays, setWeekDays] = useState<Record<WeekdayKey, DayKind>>(DEFAULT_WEEK_DAYS);
  const [grandReviewUnit, setGrandReviewUnit] = useState<GrandReviewUnit>('ayahs');
  const [grandReviewCount, setGrandReviewCount] = useState('10');
  const [start, setStart] = useState('2026-09-01');
  const [end, setEnd] = useState('2026-10-31');
  const [weeks, setWeeks] = useState('4');
  const [result, setResult] = useState<ComputeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function compute() {
    setError(null);
    const rate =
      rateType === 'ayahs'
        ? { type: 'ayahs' as const, count: Number(count) }
        : { type: rateType };
    const base = {
      direction,
      startRef: { surah: Number(surah), ayah: Number(ayah) },
      rate,
      weeklyPattern: buildPattern(weekDays, start),
      grandReview: { unit: grandReviewUnit, count: Number(grandReviewCount) },
    };
    const config =
      kind === 'closed'
        ? { ...base, kind, dates: { start, end } }
        : { ...base, kind, weeks: Number(weeks), startDate: start };
    try {
      setResult(computePlan(config as PlanConfig));
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const badRefs = result ? allRefsOf(result).filter((r) => !refExists(r.from) || !refExists(r.to)) : [];

  return (
    <main>
      <header>
        <h1>تواسع — بيئة التجربة</h1>
        <p>فحص يدوي لمخرجات المحرك الحسابي (بيئة مؤقتة تُحذف قبل الإنتاج)</p>
      </header>
      <div className="wrap">
        <div className="grid">
          <div className="card">
            <h2>مدخلات الخطة</h2>
            <div className="row">
              <label>نوع الخطة</label>
              <select value={kind} onChange={(e) => setKind(e.target.value as 'closed' | 'open')}>
                <option value="closed">محددة (بتواريخ)</option>
                <option value="open">مفتوحة (بأسابيع)</option>
              </select>
            </div>
            <div className="row">
              <label>الاتجاه</label>
              <select value={direction} onChange={(e) => setDirection(e.target.value as 'forward' | 'reverse')}>
                <option value="forward">أمامي (من البداية)</option>
                <option value="reverse">معكوس (من النهاية)</option>
              </select>
            </div>
            <div className="row inline">
              <div>
                <label>سورة البداية</label>
                <select value={surah} onChange={(e) => setSurah(e.target.value)}>
                  {SURAH_OPTIONS.map((number) => (
                    <option key={number} value={number}>
                      {surahName(number)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>آية البداية</label>
                <input type="number" min={1} value={ayah} onChange={(e) => setAyah(e.target.value)} />
              </div>
            </div>
            <div className="row">
              <label>المعدل اليومي</label>
              <select value={rateType} onChange={(e) => setRateType(e.target.value as 'half-page' | 'full-page' | 'ayahs')}>
                <option value="half-page">نصف وجه</option>
                <option value="full-page">وجه كامل</option>
                <option value="ayahs">عدد آيات</option>
              </select>
            </div>
            {rateType === 'ayahs' && (
              <div className="row">
                <label>عدد الآيات يومياً</label>
                <input type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} />
              </div>
            )}
            <div className="row">
              <label>النمط الأسبوعي (اختاري لكل يوم نوعه)</label>
              <div className="weekdays">
                {WEEKDAY_KEYS.map((key) => (
                  <div key={key} className="weekday-row">
                    <span>{WEEKDAY_LABELS[key]}</span>
                    <select
                      value={weekDays[key]}
                      onChange={(e) => setWeekDays((prev) => ({ ...prev, [key]: e.target.value as DayKind }))}
                    >
                      {DAY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div className="row inline">
              <div>
                <label>المراجعة الكبرى: الوحدة</label>
                <select value={grandReviewUnit} onChange={(e) => setGrandReviewUnit(e.target.value as GrandReviewUnit)}>
                  {GRAND_REVIEW_UNITS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>العدد يومياً</label>
                <input type="number" min={1} value={grandReviewCount} onChange={(e) => setGrandReviewCount(e.target.value)} />
              </div>
            </div>
            {kind === 'closed' ? (
              <div className="row inline">
                <div>
                  <label>تاريخ البدء</label>
                  <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                </div>
                <div>
                  <label>تاريخ النهاية</label>
                  <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="row inline">
                <div>
                  <label>عدد الأسابيع</label>
                  <input type="number" min={1} max={104} value={weeks} onChange={(e) => setWeeks(e.target.value)} />
                </div>
                <div>
                  <label>تاريخ البداية</label>
                  <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                </div>
              </div>
            )}
            <button type="button" className="btn" onClick={compute}>
              حساب الخطة
            </button>
          </div>

          <div className="card">
            <h2>المخرجات</h2>
            {error && <div className="err">{error}</div>}
            {!error && !result && <p style={{ color: 'var(--muted)', fontSize: 13 }}>أدخلي المدخلات ثم اضغطي «حساب الخطة».</p>}
            {!error && result && (
              <>
                <div className="meta">
                  <span className="pill">النهاية: {fmtRef(result.endRef)}</span>
                  <span className="pill">السور المكتملة: {result.completedSurahs.length}</span>
                  <span className="pill">المشكلات: {result.issues.length}</span>
                  <span className={badRefs.length > 0 ? 'pill bad' : 'pill'}>
                    {badRefs.length > 0 ? `مرجع خارج الفهرس: ${badRefs.length}` : 'كل المراجع من الفهرس'}
                  </span>
                </div>
                {result.issues.length > 0 && <div className="err">{result.issues.join('، ')}</div>}
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>التاريخ</th>
                      <th>النوع</th>
                      <th>الحفظ الجديد</th>
                      <th>الصغرى</th>
                      <th>الكبرى</th>
                      <th>العبارة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.days.map((day, index) => (
                      <tr key={day.date} className={day.kind === 'rest' ? 'dim' : ''}>
                        <td>{index + 1}</td>
                        <td>{day.date}</td>
                        <td>{KIND_LABELS[day.kind]}</td>
                        <td>{fmtRange(day.newMemorization)}</td>
                        <td>{fmtRange(day.smallReview)}</td>
                        <td>{fmtRange(day.grandReview)}</td>
                        <td className="phrase">{day.phrase ? 'نص ثابت' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Sandbox />);
