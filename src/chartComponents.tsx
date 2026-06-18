import { fmtNum, fmtSqmMoYear, yearlyToMonthly } from './yieldFormat'
import type { CropType } from './types'

/** Отступы Recharts: легенда снаружи графика (HTML), снизу — место под подписи осей. */
export const CHART_MARGIN = {
  compact: { top: 12, right: 12, left: 12, bottom: 44 },
  dual: { top: 12, right: 16, left: 12, bottom: 44 },
  line: { top: 12, right: 12, left: 14, bottom: 56 },
} as const

/** Узкий экран: больше места снизу под месяцы, подписи осей Y убираются (есть HTML-легенда). */
export const CHART_MARGIN_MOBILE = {
  compact: { top: 14, right: 6, left: 6, bottom: 58 },
  dual: { top: 20, right: 6, left: 6, bottom: 40 },
  line: { top: 12, right: 6, left: 10, bottom: 72 },
} as const

export type ChartMarginKey = keyof typeof CHART_MARGIN

export function pickChartMargin(key: ChartMarginKey, isMobile: boolean) {
  return isMobile ? CHART_MARGIN_MOBILE[key] : CHART_MARGIN[key]
}

export const CHART_TICK = { fontSize: 11 }
export const CHART_TICK_MOBILE = { fontSize: 9 }

export function pickChartTick(isMobile: boolean) {
  return isMobile ? CHART_TICK_MOBILE : CHART_TICK
}

type YAxisSide = 'left' | 'right'

/** На мобильном подписи осей Y скрываем — шкалы читаются по делениям, смысл в легенде под графиком. */
export function yAxisTitle(
  text: string,
  isMobile: boolean,
  side: YAxisSide = 'left',
):
  | {
      value: string
      angle: number
      position: 'insideLeft' | 'insideRight'
      offset: number
      style: { fontSize: number }
    }
  | undefined {
  if (isMobile) return undefined
  return {
    value: text,
    angle: side === 'right' ? 90 : -90,
    position: side === 'right' ? 'insideRight' : 'insideLeft',
    offset: 10,
    style: { fontSize: 11 },
  }
}

export function monthXAxisProps(isMobile: boolean) {
  if (!isMobile) return {}
  return {
    angle: -42,
    textAnchor: 'end' as const,
    height: 56,
    interval: 0 as const,
  }
}

export function lineXAxisLabel(text: string, isMobile: boolean) {
  return {
    value: text,
    position: 'bottom' as const,
    offset: isMobile ? 18 : 8,
    style: { fontSize: isMobile ? 10 : 12 },
  }
}

export interface ChartLegendItem {
  color: string
  label: string
}

export function ChartLegendRow({ items }: { items: ChartLegendItem[] }) {
  if (!items.length) return null
  return (
    <div className="chart-legend-row" aria-label="Легенда графика">
      {items.map((item) => (
        <span key={item.label} className="chart-legend-item">
          <span className="chart-legend-swatch" style={{ background: item.color }} aria-hidden />
          {item.label}
        </span>
      ))}
    </div>
  )
}

export function buildCropLegendItems(
  cropType: CropType,
  variant: 'yield' | 'kg' | 'soft',
  colors: { sd: string; dn: string; sdSoft: string; dnSoft: string },
): ChartLegendItem[] {
  const items: ChartLegendItem[] = []
  if (cropType === 'SD' || cropType === 'both') {
    const color = variant === 'soft' ? colors.sdSoft : colors.sd
    const label = variant === 'kg' ? 'КСД, кг с фермы' : 'КСД'
    items.push({ color, label })
  }
  if (cropType === 'DN' || cropType === 'both') {
    const color = variant === 'soft' ? colors.dnSoft : colors.dn
    const label = variant === 'kg' ? 'НСД, кг с фермы' : 'НСД'
    items.push({ color, label })
  }
  return items
}

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
