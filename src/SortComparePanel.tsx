import type { SortProfile } from './sortTypes'
import type { CropResult } from './calculatorTypes'
import type { CropType } from './types'
import { getBenchmarkLevel, BENCHMARK_LEVEL_LABELS } from './uiHelpers'
import { computeSortInsights, YIELD_BENCHMARKS, type SortInsights } from './sortInsights'

function fmt(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}

export function SortComparePanel({
  results,
  activeSortId,
  cropType,
  insights,
  onSelect,
}: {
  sorts: SortProfile[]
  results: Array<{ sort: SortProfile; sd: CropResult; dn: CropResult }>
  activeSortId: string
  cropType: CropType
  insights: SortInsights
  onSelect: (id: string) => void
}) {
  const showSd = cropType === 'SD' || cropType === 'both'
  const showDn = cropType === 'DN' || cropType === 'both'

  return (
    <section className="chart-card sorts-compare" id="pdf-sec-sorts-compare">
      <h3>Сравнение сортов (средний сценарий)</h3>
      <p className="hint sort-insights">{insights.summary}</p>
      <p className="hint">Нажмите на строку, чтобы открыть сорт и посмотреть детальный расчёт КСД/НСД.</p>
      <div className="table-wrap">
        <table className="sorts-compare-table">
          <thead>
            <tr>
              <th>Сорт</th>
              {showSd && (
                <>
                  <th>КСД, кг/м²/год</th>
                  <th>Ориентир КСД</th>
                </>
              )}
              {showDn && (
                <>
                  <th>НСД, кг/м²/год</th>
                  <th>Ориентир НСД</th>
                </>
              )}
              <th>Заметки</th>
            </tr>
          </thead>
          <tbody>
            {results.map(({ sort, sd, dn }) => {
              const sdLevel = getBenchmarkLevel('SD', sd.avg.marketM2PerYear, YIELD_BENCHMARKS)
              const dnLevel = getBenchmarkLevel('DN', dn.avg.marketM2PerYear, YIELD_BENCHMARKS)
              const isBestSd = insights.bestSd?.id === sort.id
              const isBestDn = insights.bestDn?.id === sort.id
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
                    {isBestSd && <span className="sort-best-badge"> лучший КСД</span>}
                    {isBestDn && <span className="sort-best-badge"> лучший НСД</span>}
                  </td>
                  {showSd && (
                    <>
                      <td>{fmt(sd.avg.marketM2PerYear)}</td>
                      <td className={`benchmark-value-${sdLevel}`}>{BENCHMARK_LEVEL_LABELS[sdLevel]}</td>
                    </>
                  )}
                  {showDn && (
                    <>
                      <td>{fmt(dn.avg.marketM2PerYear)}</td>
                      <td className={`benchmark-value-${dnLevel}`}>{BENCHMARK_LEVEL_LABELS[dnLevel]}</td>
                    </>
                  )}
                  <td className="sort-notes-cell">{sort.notes || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export { computeSortInsights }
