import { fmtNum, fmtSqmMoYear, yearlyToMonthly } from './yieldFormat'

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>
  label?: string | number
}

export function YieldSqmTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      {label != null && <p className="chart-tooltip-title">{String(label)}</p>}
      {payload.map((entry) => {
        const year = Number(entry.value)
        if (!Number.isFinite(year)) return null
        const mo = yearlyToMonthly(year)
        return (
          <p key={String(entry.dataKey)} style={{ color: entry.color }}>
            {entry.name}: {fmtSqmMoYear(mo, year)} кг/м²·мес · кг/м²/год
          </p>
        )
      })}
    </div>
  )
}

export function KgTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      {label != null && <p className="chart-tooltip-title">{String(label)}</p>}
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} style={{ color: entry.color }}>
          {entry.name}: {fmtNum(Number(entry.value), 1)} кг
        </p>
      ))}
    </div>
  )
}

export function SqmMonthTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      {label != null && <p className="chart-tooltip-title">{String(label)}</p>}
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} style={{ color: entry.color }}>
          {entry.name}: {fmtNum(Number(entry.value), 2)} кг/м²·мес
        </p>
      ))}
    </div>
  )
}

interface BarLabelProps {
  x?: number
  y?: number
  width?: number
  value?: number
}

/** Подпись над столбцом: кг/м²·мес · кг/м²/год. */
export function YieldBarTopLabel({ x, y, width, value }: BarLabelProps) {
  if (value == null || x == null || y == null || width == null) return null
  const mo = yearlyToMonthly(value)
  const text = fmtSqmMoYear(mo, value, 1, 0)
  return (
    <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={10} fill="#374151">
      {text}
    </text>
  )
}

export function KgBarTopLabel({ x, y, width, value }: BarLabelProps) {
  if (value == null || x == null || y == null || width == null) return null
  return (
    <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={10} fill="#374151">
      {fmtNum(value, 1)}
    </text>
  )
}
