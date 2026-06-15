import type { CalculatorState } from './calculatorTypes'

/** Версия модели/схемы URL. При изменении логики расчёта — увеличить и добавить миграцию. */
export const MODEL_VERSION = 3

export function parseModelVersion(params: URLSearchParams): number {
  const raw = params.get('v')
  if (raw === null) return 1
  const version = Number.parseInt(raw, 10)
  return Number.isFinite(version) && version > 0 ? version : 1
}

export function migrateCalculatorState(state: CalculatorState, fromVersion: number): CalculatorState {
  let next = state

  if (fromVersion < 2) {
    // v2: коэффициенты kLosses/kPests вместо единого realityFactor — уже в parseStateFromUrl.
  }

  if (fromVersion < 3) {
    // v3: посевная площадь, ручные коэффициенты, помесячный профиль НСД — поля с дефолтами.
    next = { ...next }
  }

  return next
}
