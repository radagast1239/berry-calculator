import type { CropResult } from './calculatorTypes'
import type { CropType } from './types'
import type { SortProfile } from './sortTypes'
import type { BerryEconAllScenarios } from './berryEcon'
import { YIELD_BENCHMARKS } from './benchmarks'

export interface SortYieldRow {
  sort: SortProfile
  sd: CropResult
  dn: CropResult
}

type BestPick = { id: string; name: string; value: number }

export interface SortInsights {
  bestSd: BestPick | null
  bestDn: BestPick | null
  bestProfit: BestPick | null
  summary: string
}

function pickBest(
  rows: Array<{ id: string; name: string; value: number }>,
): BestPick | null {
  if (!rows.length) return null
  return rows.reduce((best, row) => (row.value > best.value ? row : best))
}

export function computeSortInsights(
  rows: SortYieldRow[],
  cropType: CropType,
  econBySort?: Array<{ sortId: string; econ: BerryEconAllScenarios }>,
): SortInsights {
  const showSd = cropType === 'SD' || cropType === 'both'
  const showDn = cropType === 'DN' || cropType === 'both'

  const bestSd = showSd
    ? pickBest(rows.map(({ sort, sd }) => ({ id: sort.id, name: sort.name, value: sd.avg.marketM2PerYear })))
    : null

  const bestDn = showDn
    ? pickBest(rows.map(({ sort, dn }) => ({ id: sort.id, name: sort.name, value: dn.avg.marketM2PerYear })))
    : null

  const bestProfit = econBySort?.length
    ? pickBest(
        econBySort
          .map(({ sortId, econ }) => {
            const sort = rows.find((r) => r.sort.id === sortId)?.sort
            if (!sort) return null
            return { id: sortId, name: sort.name, value: econ.avg.netProfitRubPerYear }
          })
          .filter((row): row is BestPick => row !== null),
      )
    : null

  const parts: string[] = []
  if (bestSd) parts.push(`лучший по КСД — «${bestSd.name}» (${bestSd.value.toFixed(1)} кг/м²/год)`)
  if (bestDn) parts.push(`лучший по НСД — «${bestDn.name}» (${bestDn.value.toFixed(1)} кг/м²/год)`)
  if (bestProfit) {
    parts.push(
      `лучший по прибыли — «${bestProfit.name}» (${Math.round(bestProfit.value).toLocaleString('ru-RU')} ₽/год)`,
    )
  }

  const summary =
    parts.length > 0
      ? `Рекомендация: ${parts.join('; ')}.`
      : 'Добавьте сорта и заполните параметры для сравнения.'

  return { bestSd, bestDn, bestProfit, summary }
}

export { YIELD_BENCHMARKS }
