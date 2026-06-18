import { CHART_EXPLAIN, type ChartExplainId } from './chartExplain'
import { CHART_RISKS } from './modelCaveats'

export function ChartExplainBlock({ id }: { id: ChartExplainId }) {
  const content = CHART_EXPLAIN[id]
  const risks = content.risks ?? CHART_RISKS[id]
  return (
    <div className="chart-explain">
      <p>
        <strong>Что показывает.</strong> {content.what}
      </p>
      <p>
        <strong>Как считается.</strong> {content.how}
      </p>
      <p>
        <strong>Оси.</strong> {content.axes}
      </p>
      {content.note && <p className="chart-explain-note">{content.note}</p>}
      {risks.length > 0 && (
        <div className="model-caveats model-caveats-compact">
          <p className="model-caveats-title">Ограничения и факторы риска</p>
          <ul>
            {risks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
