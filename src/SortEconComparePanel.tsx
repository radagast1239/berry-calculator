import { calcBerryEconomicsAllScenarios, type BerryEconAllScenarios, type BerryEconState } from './berryEcon'
import { calculateCrop, sumFarmKgForScenario } from './calculatorEngine'
import type { CropType } from './types'
import { mergeToCalculatorState, type FarmSettings, type SortProfile } from './sortTypes'
import type { SortInsights } from './sortInsights'

function fmtRub(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(value)) + ' ₽'
}

export function buildSortEconRows(
  sorts: SortProfile[],
  farm: FarmSettings,
  cropType: CropType,
  econ: BerryEconState,
): Array<{ sort: SortProfile; econ: BerryEconAllScenarios }> {
  return sorts.map((sort) => {
    const calcState = mergeToCalculatorState(farm, sort.params)
    const sd = calculateCrop(calcState, 'SD')
    const dn = calculateCrop(calcState, 'DN')
    const scenarios = (['min', 'avg', 'max'] as const).reduce(
      (acc, scenario) => {
        acc[scenario] = sumFarmKgForScenario(cropType, sd[scenario], dn[scenario])
        return acc
      },
      {} as Record<'min' | 'avg' | 'max', { annualKg: number; monthlyKg: number }>,
    )
    return {
      sort,
      econ: calcBerryEconomicsAllScenarios(econ, { scenarios, farmAreaM2: farm.farmAreaM2 }),
    }
  })
}

export function SortEconComparePanel({
  rows,
  insights,
  activeSortId,
  onSelect,
}: {
  rows: Array<{ sort: SortProfile; econ: BerryEconAllScenarios }>
  insights: SortInsights
  activeSortId: string
  onSelect: (id: string) => void
}) {
  if (!rows.length) return null

  return (
    <section className="chart-card sorts-econ-compare" id="pdf-sec-sorts-econ">
      <h3>Экономика по сортам (средний сценарий урожая)</h3>
      {insights.bestProfit && (
        <p className="hint sort-insights">
          Лучший по чистой прибыли: <strong>{insights.bestProfit.name}</strong> —{' '}
          {fmtRub(insights.bestProfit.value)}/год
        </p>
      )}
      <div className="table-wrap">
        <table className="sorts-compare-table">
          <thead>
            <tr>
              <th>Сорт</th>
              <th>Выручка/год</th>
              <th>EBITDA/год</th>
              <th>Прибыль/год</th>
              <th>₽/м²/год</th>
              <th>Окупаемость</th>
              <th>ROI</th>
              <th>NPV</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ sort, econ }) => {
              const r = econ.avg
              const isBest = insights.bestProfit?.id === sort.id
              return (
                <tr
                  key={sort.id}
                  className={`${sort.id === activeSortId ? 'sorts-compare-active' : ''} ${isBest ? 'sorts-econ-best' : ''}`}
                  onClick={() => onSelect(sort.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onSelect(sort.id)
                  }}
                >
                  <td>
                    <strong>{sort.name}</strong>
                    {isBest && <span className="sort-best-badge"> лучший</span>}
                  </td>
                  <td>{fmtRub(r.revenueRubPerYear)}</td>
                  <td>{fmtRub(r.ebitdaRubPerYear)}</td>
                  <td>
                    <strong>{fmtRub(r.netProfitRubPerYear)}</strong>
                  </td>
                  <td>{fmtRub(r.netProfitRubPerM2Year)}</td>
                  <td>{r.paybackMonths === null ? '—' : `${Math.ceil(r.paybackMonths)} мес`}</td>
                  <td>{r.roiPct === null ? '—' : `${r.roiPct.toFixed(1)}%`}</td>
                  <td>{r.npvRub === null ? '—' : fmtRub(r.npvRub)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="hint">
        Мин/макс сценарии урожая — в блоке «Экономика» для открытого сорта. CAPEX, налог и ставка дисконта — общие для
        всех сортов.
      </p>
    </section>
  )
}
