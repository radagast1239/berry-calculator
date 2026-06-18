import type { CalculatorState } from './calculatorTypes'

/**
 * Параметры по опроснику агронома (С. Пуронен, июнь 2026, уточнения 18.06.2026).
 * В поля «Выход с куста» вводится ВАЛОВЫЙ урожай (кг/куст/цикл или кг/куст/условный год для НСД);
 * товарный получается через «Доля товарной ягоды» (packout).
 */
export const AGRONOMIST_PURONEN_PRESET: Pick<
  CalculatorState,
  | 'sdYieldPerPlant'
  | 'sdCycleMonths'
  | 'dnYieldPerPlant'
  | 'dnCycleMonths'
  | 'dnEstablishMonths'
  | 'dnTurnaroundMonths'
  | 'dnWaves'
  | 'dnWave1Share'
  | 'dnWave2Share'
  | 'packout'
  | 'kLosses'
  | 'kPests'
  | 'dnManualProfileEnabled'
> = {
  kLosses: 1,
  kPests: 1,
  /** Среднее товарное/валовое по опроснику (КСД и НСД); уточняйте под сорт. */
  packout: 0.85,
  dnManualProfileEnabled: false,

  /** КСД валовый, кг/куст/цикл: 300 / 600 / 1000–1200 г */
  sdYieldPerPlant: { min: 0.3, avg: 0.6, max: 1.1 },
  /** ~6 нед плодоношения + оборот; полный цикл ориентир 2–3 мес. */
  sdCycleMonths: { min: 2, avg: 2.5, max: 3 },

  /** НСД валовый, кг/куст/условный год: 500 / 700–800 / 1200–1500 г */
  dnYieldPerPlant: { min: 0.5, avg: 0.75, max: 1.35 },
  /** Длительность цикла НСД, мес (условный год плодоношения). */
  dnCycleMonths: { min: 6, avg: 7.5, max: 9 },
  /** Фаза установления до заметного плодоношения, мес. */
  dnEstablishMonths: { min: 4, avg: 5, max: 6 },
  /** Разворот/пауза между сменами когорты (зимовка, пересадка), мес. */
  dnTurnaroundMonths: { min: 4, avg: 5, max: 6 },
  /** 2 волны — норма; 3 — только редкие сорта. */
  dnWaves: { min: 2, avg: 2, max: 3 },
  /** 2 волны ~35/65; при 3 волнах (макс) ~20/50/30. */
  dnWave1Share: { min: 0.35, avg: 0.35, max: 0.2 },
  dnWave2Share: { min: 0.65, avg: 0.65, max: 0.5 },
}

export const AGRONOMIST_PURONEN_DENSITY = 20

export const AGRONOMIST_PURONEN_SORT_NOTE =
  'Без сорта · 20 раст/м² · Пуронен 06.2026. Валовый в полях урожая; товарный — через packout. Условный год НСД = период плодоношения когорты (обычно до 8–9 мес).'
