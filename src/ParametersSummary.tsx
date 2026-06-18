import type { CalculatorState } from './calculatorTypes'
import type { CropType, Scenario, Triple } from './types'

const formatValue = (value: number | null | undefined, digits = 1): string => {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toFixed(digits)
}

const SCENARIOS: Scenario[] = ['min', 'avg', 'max']
const SCENARIO_LABELS: Record<Scenario, string> = {
  min: 'Мин',
  avg: 'Средний',
  max: 'Макс',
}

interface ParamRow {
  label: string
  unit: string
  values: Triple
}

function TripleTable({ title, rows }: { title: string; rows: ParamRow[] }) {
  if (!rows.length) return null
  return (
    <div className="params-table-block">
      <h4>{title}</h4>
      <div className="table-wrap">
        <table className="params-triple-table">
          <thead>
            <tr>
              <th>Параметр</th>
              <th>Ед.</th>
              {SCENARIOS.map((scenario) => (
                <th key={scenario}>{SCENARIO_LABELS[scenario]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{row.unit}</td>
                {SCENARIOS.map((scenario) => (
                  <td key={scenario}>{formatValue(row.values[scenario], 3)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ParametersSummary({
  state,
  cropType,
  embedded = false,
}: {
  state: CalculatorState
  cropType: CropType
  /** Внутри карточки «Как читать расчёт» — без отдельной рамки. */
  embedded?: boolean
}) {
  const showSd = cropType === 'SD' || cropType === 'both'
  const showDn = cropType === 'DN' || cropType === 'both'

  const commonRows: ParamRow[] = [
    { label: 'Доля товарной ягоды', unit: '0…1', values: state.packout },
  ]

  const sdRows: ParamRow[] = [
    { label: 'Выход с куста за цикл', unit: 'кг', values: state.sdYieldPerPlant },
    { label: 'Длина цикла', unit: 'мес', values: state.sdCycleMonths },
  ]

  const dnRows: ParamRow[] = [
    { label: 'Выход с куста за цикл', unit: 'кг', values: state.dnYieldPerPlant },
    { label: 'Длина цикла', unit: 'мес', values: state.dnCycleMonths },
    { label: 'Оборот между циклами', unit: 'мес', values: state.dnTurnaroundMonths },
    { label: 'Потери 1-й цветоносы', unit: 'доля', values: state.dnInflorescenceLoss },
    { label: 'Количество волн', unit: 'шт', values: state.dnWaves },
    { label: 'Установление до сбора', unit: 'мес', values: state.dnEstablishMonths },
    { label: 'Доля 1-й волны', unit: '0…1', values: state.dnWave1Share },
    { label: 'Доля 2-й волны', unit: '0…1', values: state.dnWave2Share },
    { label: 'Масса ягоды', unit: 'г', values: state.berryMassG },
  ]

  const body = (
    <>
      <h3 className="params-summary-title">Параметры расчёта (Мин / Средний / Макс)</h3>
      <p className="hint">
        Все сценарные диапазоны, заданные в калькуляторе. Общие поля (плотность, площадь, коэффициенты потерь)
        одинаковы для всех сценариев.
      </p>

      <div className="params-single-grid">
        <div className="params-single-item">
          <span className="params-single-label">Плотность</span>
          <span className="params-single-value">{formatValue(state.density, 1)} раст/м²</span>
        </div>
        <div className="params-single-item">
          <span className="params-single-label">Площадь фермы</span>
          <span className="params-single-value">{formatValue(state.farmAreaM2, 1)} м²</span>
        </div>
        <div className="params-single-item">
          <span className="params-single-label">Техн. потери</span>
          <span className="params-single-value">{formatValue(state.kLosses, 3)}</span>
        </div>
        <div className="params-single-item">
          <span className="params-single-label">Риски</span>
          <span className="params-single-value">{formatValue(state.kPests, 3)}</span>
        </div>
        <div className="params-single-item">
          <span className="params-single-label">Неопределённость</span>
          <span className="params-single-value">{formatValue(state.uncertaintyPct, 0)}%</span>
        </div>
      </div>

      <TripleTable title="Качество" rows={commonRows} />
      {showSd && <TripleTable title="КСД" rows={sdRows} />}
      {showDn && <TripleTable title="НСД" rows={dnRows} />}
    </>
  )

  if (embedded) {
    return (
      <div className="params-summary-embedded" id="pdf-sec-inputs">
        {body}
      </div>
    )
  }

  return (
    <section className="chart-card params-summary-card" id="pdf-sec-inputs">
      {body}
    </section>
  )
}
