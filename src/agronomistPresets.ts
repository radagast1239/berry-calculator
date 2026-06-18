import type { CalculatorState } from './calculatorTypes'

/**
 * Параметры по опроснику агронома (С. Пуронен, июнь 2026).
 * В поля «Выход с куста» вводится ВАЛОВЫЙ урожай (кг/куст/цикл);
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
  /** Среднее отношение товарного к валовому по опроснику (~0.67–0.92). */
  packout: 0.85,
  dnManualProfileEnabled: false,

  /** КСД валовый: 300 / 600 / 1100 г за цикл → кг */
  sdYieldPerPlant: { min: 0.3, avg: 0.6, max: 1.1 },
  /** ~6 нед плодоношения + оборот; полный цикл ориентир 2–3 мес. */
  sdCycleMonths: { min: 2, avg: 2.5, max: 3 },

  /** НСД валовый за «условный год» (≈ один цикл 6–9 мес): 500 / 750 / 1350 г */
  dnYieldPerPlant: { min: 0.5, avg: 0.75, max: 1.35 },
  dnCycleMonths: { min: 8, avg: 8.5, max: 9 },
  /**
   * Месяцы до первого сбора новой когорты. Опросник: 4–6 мес — возраст до плодоношения;
   * на календаре год идёт за счёт перекрывающихся когорт (ступенчатая замена кустов).
   */
  dnEstablishMonths: { min: 3, avg: 4, max: 5 },
  /** Пауза между полными сменами когорты (зимовка). */
  dnTurnaroundMonths: { min: 4, avg: 5, max: 6 },
  /** Планировать 2 волны; 3 — только для редких сортов (макс). */
  dnWaves: { min: 2, avg: 2, max: 3 },
  /** 2 волны: ~35/65; 3 волны (макс): 20/50/30. */
  dnWave1Share: { min: 0.35, avg: 0.35, max: 0.2 },
  dnWave2Share: { min: 0.45, avg: 0.45, max: 0.5 },
}

export const AGRONOMIST_PURONEN_DENSITY = 20

export const AGRONOMIST_PURONEN_SORT_NOTE =
  'Без сорта · 20 раст/м² · опросник агронома (Пуронен, 06.2026). Условный год НСД ≈ 8–9 мес плодоношения в одном цикле.'
