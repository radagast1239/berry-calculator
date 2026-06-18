import type { CalculatorState } from './calculatorTypes'

/**
 * Параметры по опроснику агронома (С. Пуронен, июнь 2026, уточнения 18.06.2026).
 * В поля «Выход с куста» — ВАЛОВЫЙ урожай; товарный = валовый × packout[сценарий].
 */
export const AGRONOMIST_PURONEN_PRESET: Pick<
  CalculatorState,
  | 'sdYieldPerPlant'
  | 'sdCycleMonths'
  | 'sdFruitingWeeks'
  | 'sdWeeklyShares'
  | 'dnYieldPerPlant'
  | 'dnCycleMonths'
  | 'dnEstablishMonths'
  | 'dnTurnaroundMonths'
  | 'dnWaves'
  | 'dnWave1Share'
  | 'dnWave2Share'
  | 'dnSeedlingMaterial'
  | 'dnInflorescenceLoss'
  | 'packout'
  | 'kLosses'
  | 'kPests'
  | 'dnManualProfileEnabled'
> = {
  kLosses: 1,
  kPests: 1,
  dnManualProfileEnabled: false,

  /** Товарный/валовый по опроснику (КСД и НСД усреднённо). */
  packout: { min: 0.67, avg: 0.85, max: 0.86 },

  sdFruitingWeeks: 6,
  sdWeeklyShares: [0.1, 0.1, 0.2, 0.35, 0.2, 0.05],

  sdYieldPerPlant: { min: 0.3, avg: 0.6, max: 1.1 },
  sdCycleMonths: { min: 2, avg: 2.5, max: 3 },

  dnYieldPerPlant: { min: 0.5, avg: 0.75, max: 1.35 },
  dnCycleMonths: { min: 6, avg: 7.5, max: 9 },
  dnEstablishMonths: { min: 4, avg: 5, max: 6 },
  dnTurnaroundMonths: { min: 4, avg: 5, max: 6 },
  dnWaves: { min: 2, avg: 2, max: 3 },
  dnWave1Share: { min: 0.35, avg: 0.35, max: 0.2 },
  dnWave2Share: { min: 0.65, avg: 0.65, max: 0.5 },
  dnSeedlingMaterial: 'tray',
  dnInflorescenceLoss: { min: 0.2, avg: 0.05, max: 0 },
}

export const AGRONOMIST_PURONEN_DENSITY = 20

export const AGRONOMIST_PURONEN_SORT_NOTE =
  'Без сорта · 20 раст/м² · Пуронен 06.2026. Валовый в урожае; доля товарной ягоды по сценариям. НСД: условный год ≈ 6–9 мес.'
