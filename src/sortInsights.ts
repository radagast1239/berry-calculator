import type { CropResult } from './calculatorTypes'
import type { CropType } from './types'
import type { SortProfile } from './sortTypes'
import type { BerryEconAllScenarios } from './berryEcon'
import { YIELD_BENCHMARKS } from './benchmarks'
import { fmtSqmMoYear } from './yieldFormat'

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
  if (bestSd) {
    const row = rows.find((r) => r.sort.id === bestSd.id)
    const mo = row ? row.sd.avg.marketM2PerMonth : bestSd.value / 12
    parts.push(
      `лучший по КСД — «${bestSd.name}» (${fmtSqmMoYear(mo, bestSd.value)} кг/м²·мес · кг/м²/год)`,
    )
  }
  if (bestDn) {
    const row = rows.find((r) => r.sort.id === bestDn.id)
    const mo = row ? row.dn.avg.marketM2PerMonth : bestDn.value / 12
    parts.push(
      `лучший по НСД — «${bestDn.name}» (${fmtSqmMoYear(mo, bestDn.value)} кг/м²·мес · кг/м²/год)`,
    )
  }
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
