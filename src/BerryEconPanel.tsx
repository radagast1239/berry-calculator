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
      <h3>Экономика ягоды (расширенная, без сезонности)</h3>
      <p className="hint">
        Модель берёт ваш расчёт урожая (кг/мес и кг/год с фермы) и переводит в деньги. Это годовая/помесячная экономика
        без сезонности: выручка − комиссия − переменные − фиксированные = EBITDA, затем (опционально) налог = чистая прибыль.
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
          <HintLabel label="Комиссия/сбыт, % от выручки" hint="Маркетплейс, комиссия сети, агентские, скидки как % от выручки." />
          <input
            type="number"
            min={0}
            max={50}
            step={0.5}
            value={econ.salesFeePct}
            onChange={(e) => set('salesFeePct', Number(e.target.value))}
          />
        </label>
      </div>

      <div className="inputs-row">
        <label className="field">
          <HintLabel label="Электричество, ₽/мес" hint="Суммарно по ферме (свет+прочее)." />
          <input
            type="number"
            min={0}
            step={1000}
            value={econ.electricityRubPerMonth}
            onChange={(e) => set('electricityRubPerMonth', Number(e.target.value))}
          />
        </label>
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
      </div>

      <div className="inputs-row">
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
        <label className="field">
          <HintLabel label="Обслуживание/ремонт, ₽/мес" hint="Сервис, расходники инфраструктуры, ремонты, ЗИП." />
          <input
            type="number"
            min={0}
            step={1000}
            value={econ.maintenanceRubPerMonth}
            onChange={(e) => set('maintenanceRubPerMonth', Number(e.target.value))}
          />
        </label>
      </div>

      <div className="inputs-row">
        <label className="field">
          <HintLabel label="Админ/управление, ₽/мес" hint="Бухгалтерия, управление, связь, софт, офисные расходы." />
          <input
            type="number"
            min={0}
            step={1000}
            value={econ.adminRubPerMonth}
            onChange={(e) => set('adminRubPerMonth', Number(e.target.value))}
          />
        </label>
        <label className="field">
          <HintLabel label="Прочие, ₽/мес" hint="Любые прочие фиксированные статьи." />
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
        <label className="field">
          <HintLabel label="Налог на прибыль, %" hint="Если хотите оценить чистую прибыль. 0% — не учитывать." />
          <input
            type="number"
            min={0}
            max={50}
            step={0.5}
            value={econ.taxPct}
            onChange={(e) => set('taxPct', Number(e.target.value))}
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
              <td>Комиссия/сбыт, ₽/мес</td>
              <td>{fmtRub(result.salesFeeRubPerMonth)}</td>
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
              <td>EBITDA, ₽/мес</td>
              <td>
                <strong>{fmtRub(result.ebitdaRubPerMonth)}</strong>
              </td>
            </tr>
            <tr>
              <td>EBITDA, ₽/год</td>
              <td>{fmtRub(result.ebitdaRubPerYear)}</td>
            </tr>
            <tr>
              <td>Налог, ₽/мес</td>
              <td>{fmtRub(result.taxRubPerMonth)}</td>
            </tr>
            <tr className="sensitivity-base">
              <td>Чистая прибыль, ₽/мес</td>
              <td>
                <strong>{fmtRub(result.netProfitRubPerMonth)}</strong>
              </td>
            </tr>
            <tr>
              <td>Чистая прибыль, ₽/год</td>
              <td>{fmtRub(result.netProfitRubPerYear)}</td>
            </tr>
            <tr>
              <td>Маржинальность (вклад), ₽/кг</td>
              <td>{Math.round(result.contributionRubPerKg)} ₽/кг</td>
            </tr>
            <tr>
              <td>Чистая прибыль на 1 кг, ₽/кг</td>
              <td>{Math.round(result.netUnitProfitRubPerKg)} ₽/кг</td>
            </tr>
            <tr>
              <td>Точка безубыточности, кг/мес</td>
              <td>{result.breakEvenKgPerMonth === null ? '—' : `${Math.ceil(result.breakEvenKgPerMonth)} кг/мес`}</td>
            </tr>
            <tr>
              <td>Безубыточная цена при текущем объёме, ₽/кг</td>
              <td>{result.breakEvenPriceRubPerKg === null ? '—' : `${Math.ceil(result.breakEvenPriceRubPerKg)} ₽/кг`}</td>
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

