import { CHART_EXPLAIN, type ChartExplainId } from './chartExplain'

export function ChartExplainBlock({ id }: { id: ChartExplainId }) {
  const content = CHART_EXPLAIN[id]
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
    </div>
  )
}
