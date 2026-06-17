import { useMemo } from 'react'
import { calcBerryEconomicsAllScenarios, totalCapexRub, type BerryEconState } from './berryEcon'
import { sumFarmKgForScenario } from './calculatorEngine'
import type { CropResult } from './calculatorTypes'
import type { CropType } from './types'
import { HintLabel } from './uiHelpers'
import { fmtFarmMoYear, YIELD_COL } from './yieldFormat'

function fmtRub(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(value)) + ' ₽'
}

export function BerryEconPanel({
  econ,
  onChange,
  farmAreaM2,
  cropType,
  sdResult,
  dnResult,
}: {
  econ: BerryEconState
  onChange: (next: BerryEconState) => void
  farmAreaM2: number
  cropType: CropType
  sdResult: CropResult
  dnResult: CropResult
}) {
  const scenarios = useMemo(() => {
    const keys = (['min', 'avg', 'max'] as const).map((scenario) => ({
      scenario,
      ...sumFarmKgForScenario(cropType, sdResult[scenario], dnResult[scenario]),
    }))
    return { min: keys[0], avg: keys[1], max: keys[2] }
  }, [cropType, sdResult, dnResult])

  const allScenarios = useMemo(
    () =>
      calcBerryEconomicsAllScenarios(econ, {
        farmAreaM2,
        scenarios: {
          min: { monthlyKg: scenarios.min.monthlyKg, annualKg: scenarios.min.annualKg },
          avg: { monthlyKg: scenarios.avg.monthlyKg, annualKg: scenarios.avg.annualKg },
          max: { monthlyKg: scenarios.max.monthlyKg, annualKg: scenarios.max.annualKg },
        },
      }),
    [econ, farmAreaM2, scenarios],
  )

  const result = allScenarios.avg
  const capexTotal = totalCapexRub(econ)

  const set = (key: keyof BerryEconState, value: number) => {
    onChange({ ...econ, [key]: Number.isFinite(value) ? value : 0 })
  }

  return (
    <section className="chart-card" id="pdf-sec-econ">
      <h3>Экономика ягоды (расширенная, без сезонности)</h3>
      <p className="hint">
        Годовая модель без сезонности. Сценарии Мин/Сред/Макс — из расчёта урожая открытого сорта.
      </p>

      <details open>
        <summary>Цена и переменные</summary>
        <div className="inputs-row">
          <label className="field">
            <HintLabel label="Цена продажи, ₽/кг" hint="Средняя цена реализации." />
            <input type="number" min={0} step={10} value={econ.salePriceRubPerKg} onChange={(e) => set('salePriceRubPerKg', Number(e.target.value))} />
          </label>
          <label className="field">
            <HintLabel label="Переменные, ₽/кг" hint="Субстрат, СЗР, расходники." />
            <input type="number" min={0} step={10} value={econ.variableCostRubPerKg} onChange={(e) => set('variableCostRubPerKg', Number(e.target.value))} />
          </label>
          <label className="field">
            <HintLabel label="Упаковка, ₽/кг" hint="Упаковка и логистика на кг." />
            <input type="number" min={0} step={5} value={econ.packagingRubPerKg} onChange={(e) => set('packagingRubPerKg', Number(e.target.value))} />
          </label>
          <label className="field">
            <HintLabel label="Комиссия, %" hint="Сбыт, маркетплейс." />
            <input type="number" min={0} max={50} step={0.5} value={econ.salesFeePct} onChange={(e) => set('salesFeePct', Number(e.target.value))} />
          </label>
        </div>
      </details>

      <details>
        <summary>Фиксированные, ₽/мес</summary>
        <div className="inputs-row">
          <label className="field"><span>Электричество</span><input type="number" min={0} step={1000} value={econ.electricityRubPerMonth} onChange={(e) => set('electricityRubPerMonth', Number(e.target.value))} /></label>
          <label className="field"><span>Аренда</span><input type="number" min={0} step={1000} value={econ.rentRubPerMonth} onChange={(e) => set('rentRubPerMonth', Number(e.target.value))} /></label>
          <label className="field"><span>ФОТ</span><input type="number" min={0} step={1000} value={econ.payrollRubPerMonth} onChange={(e) => set('payrollRubPerMonth', Number(e.target.value))} /></label>
          <label className="field"><span>Обслуживание</span><input type="number" min={0} step={1000} value={econ.maintenanceRubPerMonth} onChange={(e) => set('maintenanceRubPerMonth', Number(e.target.value))} /></label>
          <label className="field"><span>Админ</span><input type="number" min={0} step={1000} value={econ.adminRubPerMonth} onChange={(e) => set('adminRubPerMonth', Number(e.target.value))} /></label>
          <label className="field"><span>Прочие</span><input type="number" min={0} step={1000} value={econ.otherRubPerMonth} onChange={(e) => set('otherRubPerMonth', Number(e.target.value))} /></label>
        </div>
      </details>

      <details>
        <summary>CAPEX и финансы</summary>
        <div className="inputs-row">
          <label className="field"><span>Оборудование, ₽</span><input type="number" min={0} step={100000} value={econ.capexEquipmentRub} onChange={(e) => set('capexEquipmentRub', Number(e.target.value))} /></label>
          <label className="field"><span>Монтаж, ₽</span><input type="number" min={0} step={100000} value={econ.capexInstallRub} onChange={(e) => set('capexInstallRub', Number(e.target.value))} /></label>
          <label className="field"><span>Пусконаладка, ₽</span><input type="number" min={0} step={50000} value={econ.capexCommissioningRub} onChange={(e) => set('capexCommissioningRub', Number(e.target.value))} /></label>
          <label className="field"><span>Оборотка, ₽</span><input type="number" min={0} step={50000} value={econ.capexWorkingCapitalRub} onChange={(e) => set('capexWorkingCapitalRub', Number(e.target.value))} /></label>
          <label className="field"><span>Налог, %</span><input type="number" min={0} max={50} step={0.5} value={econ.taxPct} onChange={(e) => set('taxPct', Number(e.target.value))} /></label>
          <label className="field"><span>Дисконт, %</span><input type="number" min={0} max={50} step={0.5} value={econ.discountRatePct} onChange={(e) => set('discountRatePct', Number(e.target.value))} /></label>
          <label className="field"><span>Горизонт NPV, лет</span><input type="number" min={1} max={30} step={1} value={econ.horizonYears} onChange={(e) => set('horizonYears', Number(e.target.value))} /></label>
        </div>
        <p className="hint">Итого CAPEX: <strong>{fmtRub(capexTotal)}</strong></p>
      </details>

      <div className="table-wrap">
        <table className="sensitivity-table">
          <thead>
            <tr>
              <th>Сценарий</th>
              <th>{YIELD_COL.farm}</th>
              <th>Выручка</th>
              <th>EBITDA</th>
              <th>Прибыль</th>
              <th>₽/м²</th>
              <th>Окупаемость</th>
            </tr>
          </thead>
          <tbody>
            {(['min', 'avg', 'max'] as const).map((scenario) => {
              const r = allScenarios[scenario]
              const label = scenario === 'min' ? 'Мин' : scenario === 'avg' ? 'Средний' : 'Макс'
              return (
                <tr key={scenario} className={scenario === 'avg' ? 'sensitivity-base' : ''}>
                  <td>{label}</td>
                  <td>{fmtFarmMoYear(scenarios[scenario].monthlyKg, scenarios[scenario].annualKg)}</td>
                  <td>{fmtRub(r.revenueRubPerYear)}</td>
                  <td>{fmtRub(r.ebitdaRubPerYear)}</td>
                  <td><strong>{fmtRub(r.netProfitRubPerYear)}</strong></td>
                  <td>{fmtRub(r.netProfitRubPerM2Year)}</td>
                  <td>{r.paybackMonths === null ? '—' : `${Math.ceil(r.paybackMonths)} мес`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="table-wrap">
        <table className="sensitivity-table">
          <tbody>
            <tr className="sensitivity-base">
              <td>ROI (средний)</td>
              <td>{result.roiPct === null ? '—' : `${result.roiPct.toFixed(1)}%`}</td>
            </tr>
            <tr>
              <td>NPV ({econ.horizonYears} лет)</td>
              <td>{result.npvRub === null ? '—' : fmtRub(result.npvRub)}</td>
            </tr>
            <tr>
              <td>Безубыточность</td>
              <td>{result.breakEvenKgPerMonth === null ? '—' : `${Math.ceil(result.breakEvenKgPerMonth)} кг/мес`}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
