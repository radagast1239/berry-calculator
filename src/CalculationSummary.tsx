import type { CalculatorState, CropResult } from './calculatorTypes'
import { CALCULATION_STEPS } from './chartExplain'
import { MODEL_DISCLAIMER } from './modelCaveats'
import { ParametersSummary } from './ParametersSummary'
import { fmtSqmMoYear } from './yieldFormat'

export function CalculationSummary({
  state,
  sdResult,
  dnResult,
}: {
  state: CalculatorState
  sdResult: CropResult
  dnResult: CropResult
}) {
  const showSd = state.cropType === 'SD' || state.cropType === 'both'
  const showDn = state.cropType === 'DN' || state.cropType === 'both'

  return (
    <section className="chart-card methods-card" id="pdf-sec-methods">
      <ParametersSummary state={state} cropType={state.cropType} embedded />
      <div className="methods-section-divider" aria-hidden="true" />
      <h3>Как читать расчёт</h3>
      <p className="hint methods-lead">
        Ниже — цепочка формул модели. Все «кг/м²» в карточках результатов — на{' '}
        <strong>полезной посевной площади</strong>, если не указано иное.
      </p>
      <ol className="methods-steps">
        {CALCULATION_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <div className="methods-example">
        <h4>Пример на ваших параметрах (средний сценарий)</h4>
        <ul className="guide-list">
          <li>
            <strong>Плотность:</strong> {state.density} раст/м² · <strong>Площадь фермы:</strong>{' '}
            {state.farmAreaM2} м²
          </li>
          <li>
            <strong>Качество:</strong> потери {state.kLosses}, риски {state.kPests}, доля товарной ягоды (средний){' '}
            {state.packout.avg} → итоговый коэффициент{' '}
            {(state.kLosses * state.kPests * state.packout.avg).toFixed(3)}
          </li>
          {showSd && (
            <li>
              <strong>КСД:</strong> {state.sdYieldPerPlant.avg} кг/куст/цикл · цикл {state.sdCycleMonths.avg} мес →{' '}
              {sdResult.avg.cyclesPerYear.toFixed(2)} циклов/год → товарный{' '}
              {fmtSqmMoYear(sdResult.avg.marketM2PerMonth, sdResult.avg.marketM2PerYear)} кг/м²·мес · кг/м²/год
            </li>
          )}
          {showDn && (
            <li>
              <strong>НСД:</strong> {state.dnYieldPerPlant.avg} кг/куст/цикл · цикл {state.dnCycleMonths.avg} мес +
              оборот {state.dnTurnaroundMonths.avg} мес → {dnResult.avg.cyclesPerYear.toFixed(2)} циклов/год →
              товарный {fmtSqmMoYear(dnResult.avg.marketM2PerMonth, dnResult.avg.marketM2PerYear)} кг/м²·мес ·
              кг/м²/год
            </li>
          )}
        </ul>
      </div>

      <p className="hint chart-explain-note">
        Графики ниже — визуализация тех же формул. У каждого блока — пояснение и блок «Ограничения и факторы риска».
      </p>
      <p className="hint model-disclaimer">{MODEL_DISCLAIMER}</p>
    </section>
  )
}
