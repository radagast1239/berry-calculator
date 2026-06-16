import type { CropResult } from './calculatorTypes'
import type { CropType } from './types'
import type { SortProfile } from './sortTypes'
import { getBenchmarkLevel, BENCHMARK_LEVEL_LABELS } from './uiHelpers'

const BENCHMARKS = {
  SD: { confirmed: [32, 40] as const, ceiling: [40, 48] as const, max: 60 },
  DN: { confirmed: [34, 41] as const, ceiling: [40, 60] as const, max: 70 },
}

function fmt(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}

export function SortComparePanel({
  results,
  activeSortId,
  cropType,
  onSelect,
}: {
  sorts: SortProfile[]
  results: Array<{ sort: SortProfile; sd: CropResult; dn: CropResult }>
  activeSortId: string
  cropType: CropType
  onSelect: (id: string) => void
}) {
  const showSd = cropType === 'SD' || cropType === 'both'
  const showDn = cropType === 'DN' || cropType === 'both'

  return (
    <section className="chart-card sorts-compare" id="pdf-sec-sorts-compare">
      <h3>Сравнение сортов (средний сценарий)</h3>
      <p className="hint">Нажмите на строку, чтобы открыть сорт и посмотреть детальный расчёт КСД/НСД.</p>
      <div className="table-wrap">
        <table className="sorts-compare-table">
          <thead>
            <tr>
              <th>Сорт</th>
              {showSd && (
                <>
                  <th>КСД, кг/м²/год</th>
                  <th>КСД, кг/год фермы</th>
                </>
              )}
              {showDn && (
                <>
                  <th>НСД, кг/м²/год</th>
                  <th>НСД, кг/год фермы</th>
                </>
              )}
              <th>Ориентир</th>
            </tr>
          </thead>
          <tbody>
            {results.map(({ sort, sd, dn }) => {
              const sdLevel = getBenchmarkLevel('SD', sd.avg.marketM2PerYear, BENCHMARKS)
              const dnLevel = getBenchmarkLevel('DN', dn.avg.marketM2PerYear, BENCHMARKS)
              const level = showSd && showDn ? (sd.avg.marketM2PerYear >= dn.avg.marketM2PerYear ? sdLevel : dnLevel) : showSd ? sdLevel : dnLevel
              return (
                <tr
                  key={sort.id}
                  className={sort.id === activeSortId ? 'sorts-compare-active' : ''}
                  onClick={() => onSelect(sort.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onSelect(sort.id)
                  }}
                >
                  <td>
                    <strong>{sort.name}</strong>
                    {sort.id === activeSortId && <span className="sort-open-badge"> открыт</span>}
                  </td>
                  {showSd && (
                    <>
                      <td>{fmt(sd.avg.marketM2PerYear)}</td>
                      <td>{fmt(sd.avg.farmMarketAnnualKg, 0)}</td>
                    </>
                  )}
                  {showDn && (
                    <>
                      <td>{fmt(dn.avg.marketM2PerYear)}</td>
                      <td>{fmt(dn.avg.farmMarketAnnualKg, 0)}</td>
                    </>
                  )}
                  <td className={`benchmark-value-${level}`}>{BENCHMARK_LEVEL_LABELS[level]}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
