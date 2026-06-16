import { useMemo } from 'react'
import { calcBerryEconomics, type BerryEconState } from './berryEcon'
import { HintLabel } from './uiHelpers'

function fmtRub(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(value)) + ' ₽'
}

export function BerryEconPanel({
  econ,
  onChange,
  annualKg,
  monthlyKg,
}: {
  econ: BerryEconState
  onChange: (next: BerryEconState) => void
  annualKg: number
  monthlyKg: number
}) {
  const result = useMemo(() => calcBerryEconomics(econ, { annualKg, monthlyKg }), [econ, annualKg, monthlyKg])

  const set = (key: keyof BerryEconState, value: number) => {
    onChange({ ...econ, [key]: Number.isFinite(value) ? value : 0 })
  }

  return (
    <section className="chart-card" id="pdf-sec-econ">
      <h3>Экономика ягоды (черновой расчёт)</h3>
      <p className="hint">
        Модель берёт ваш расчёт урожая (кг/мес и кг/год с фермы) и переводит в деньги. Это упрощённая экономика «как в
        соседнем проекте»: выручка − переменные − фиксированные = прибыль и окупаемость CAPEX.
      </p>

      <div className="inputs-row">
        <label className="field">
          <HintLabel label="Цена продажи, ₽/кг" hint="Средняя цена реализации товарной ягоды." />
          <input
            type="number"
            min={0}
            step={10}
            value={econ.salePriceRubPerKg}
            onChange={(e) => set('salePriceRubPerKg', Number(e.target.value))}
          />
        </label>
        <label className="field">
          <HintLabel label="Переменные затраты, ₽/кг" hint="Субстрат, СЗР, расходники на цикл, потери при сборе (в деньгах)." />
          <input
            type="number"
            min={0}
            step={10}
            value={econ.variableCostRubPerKg}
            onChange={(e) => set('variableCostRubPerKg', Number(e.target.value))}
          />
        </label>
      </div>

      <div className="inputs-row">
        <label className="field">
          <HintLabel label="Упаковка/логистика на кг, ₽/кг" hint="Упаковка, этикетка, доп. логистика на единицу продукции." />
          <input
            type="number"
            min={0}
            step={5}
            value={econ.packagingRubPerKg}
            onChange={(e) => set('packagingRubPerKg', Number(e.target.value))}
          />
        </label>
        <label className="field">
          <HintLabel label="Электричество, ₽/мес" hint="Можно ввести суммарную цифру по ферме (свет+прочее)." />
          <input
            type="number"
            min={0}
            step={1000}
            value={econ.electricityRubPerMonth}
            onChange={(e) => set('electricityRubPerMonth', Number(e.target.value))}
          />
        </label>
      </div>

      <div className="inputs-row">
        <label className="field">
          <HintLabel label="Аренда, ₽/мес" hint="Аренда помещения/площадки." />
          <input
            type="number"
            min={0}
            step={1000}
            value={econ.rentRubPerMonth}
            onChange={(e) => set('rentRubPerMonth', Number(e.target.value))}
          />
        </label>
        <label className="field">
          <HintLabel label="ФОТ, ₽/мес" hint="Фонд оплаты труда (с учётом налогов/взносов, если хотите)." />
          <input
            type="number"
            min={0}
            step={1000}
            value={econ.payrollRubPerMonth}
            onChange={(e) => set('payrollRubPerMonth', Number(e.target.value))}
          />
        </label>
      </div>

      <div className="inputs-row">
        <label className="field">
          <HintLabel label="Логистика (фикс.), ₽/мес" hint="Если логистика считается фиксированной статьёй, а не на кг." />
          <input
            type="number"
            min={0}
            step={1000}
            value={econ.logisticsRubPerMonth}
            onChange={(e) => set('logisticsRubPerMonth', Number(e.target.value))}
          />
        </label>
        <label className="field">
          <HintLabel label="Прочие, ₽/мес" hint="Ремонт, обслуживание, бухгалтерия, вода и т.п." />
          <input
            type="number"
            min={0}
            step={1000}
            value={econ.otherRubPerMonth}
            onChange={(e) => set('otherRubPerMonth', Number(e.target.value))}
          />
        </label>
      </div>

      <div className="inputs-row">
        <label className="field">
          <HintLabel label="CAPEX, ₽" hint="Единовременные вложения. Окупаемость считается как CAPEX / прибыль в месяц." />
          <input
            type="number"
            min={0}
            step={100000}
            value={econ.capexRub}
            onChange={(e) => set('capexRub', Number(e.target.value))}
          />
        </label>
        <div className="field">
          <span>Урожай из расчёта</span>
          <div className="hint">
            {fmtRub(result.revenueRubPerMonth)} / мес при {Math.round(monthlyKg)} кг/мес · {Math.round(annualKg)} кг/год
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="sensitivity-table">
          <tbody>
            <tr>
              <td>Выручка, ₽/мес</td>
              <td>
                <strong>{fmtRub(result.revenueRubPerMonth)}</strong>
              </td>
            </tr>
            <tr>
              <td>Переменные, ₽/мес</td>
              <td>{fmtRub(result.variableRubPerMonth)}</td>
            </tr>
            <tr>
              <td>Фиксированные, ₽/мес</td>
              <td>{fmtRub(result.fixedRubPerMonth)}</td>
            </tr>
            <tr className="sensitivity-base">
              <td>Прибыль, ₽/мес</td>
              <td>
                <strong>{fmtRub(result.profitRubPerMonth)}</strong>
              </td>
            </tr>
            <tr>
              <td>Прибыль, ₽/год</td>
              <td>{fmtRub(result.profitRubPerYear)}</td>
            </tr>
            <tr>
              <td>Прибыль на 1 кг, ₽/кг</td>
              <td>{Math.round(result.unitProfitRubPerKg)} ₽/кг</td>
            </tr>
            <tr>
              <td>Окупаемость CAPEX</td>
              <td>{result.paybackMonths === null ? '—' : `${Math.ceil(result.paybackMonths)} мес`}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

