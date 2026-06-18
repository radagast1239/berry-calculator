import type { CalculatorState } from './calculatorTypes'
import type { Triple } from './types'

/** Версия модели/схемы URL. При изменении логики расчёта — увеличить и добавить миграцию. */
export const MODEL_VERSION = 4

export function parseModelVersion(params: URLSearchParams): number {
  const raw = params.get('v')
  if (raw === null) return 1
  const version = Number.parseInt(raw, 10)
  return Number.isFinite(version) && version > 0 ? version : 1
}

function migratePackout(value: unknown, fallback: Triple): Triple {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const v = value
    return { min: v, avg: v, max: v }
  }
  if (value && typeof value === 'object') {
    const triple = value as Partial<Triple>
    return {
      min: typeof triple.min === 'number' ? triple.min : fallback.min,
      avg: typeof triple.avg === 'number' ? triple.avg : fallback.avg,
      max: typeof triple.max === 'number' ? triple.max : fallback.max,
    }
  }
  return { ...fallback }
}

export function migrateCalculatorState(state: CalculatorState, fromVersion: number): CalculatorState {
  let next = state

  if (fromVersion < 4) {
    const legacyPackout = (state as CalculatorState & { packout?: unknown }).packout
    next = {
      ...next,
      packout: migratePackout(legacyPackout, next.packout ?? { min: 1, avg: 1, max: 1 }),
      sdFruitingWeeks: next.sdFruitingWeeks ?? 6,
      sdWeeklyShares: next.sdWeeklyShares?.length ? [...next.sdWeeklyShares] : [0.1, 0.1, 0.2, 0.35, 0.2, 0.05],
      dnSeedlingMaterial: next.dnSeedlingMaterial ?? 'manual',
      dnInflorescenceLoss: next.dnInflorescenceLoss ?? { min: 0.15, avg: 0.05, max: 0 },
    }
  }

  return next
}
