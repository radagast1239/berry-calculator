import { CHART_MARGIN } from './chartComponents'
import { CHART } from './chartColors'

export interface ProfileChartPoint {
  month: number
  marketKgPerMonth: number
}

export interface ProfileChartSpec {
  points: ProfileChartPoint[]
  color: string
  xMax: number
  xTicks: number[]
  yDomain: [number, number]
  yTicks: number[]
  xLabel: string
  yLabel: string
  width: number
  height: number
  scale?: number
}

/** Профиль КСД/НСД в PDF из данных расчёта (без clip-path Recharts). */
export function renderProfileLineChartCanvas(spec: ProfileChartSpec): HTMLCanvasElement {
  const scale = spec.scale ?? 2
  const margin = CHART_MARGIN.line
  const width = spec.width
  const height = spec.height
  const plotLeft = margin.left
  const plotRight = width - margin.right
  const plotTop = margin.top
  const plotBottom = height - margin.bottom
  const plotW = plotRight - plotLeft
  const plotH = plotBottom - plotTop
  const xMax = Math.max(spec.xMax, 0.001)
  const yMax = Math.max(spec.yDomain[1], 0.001)

  const xAt = (month: number) => plotLeft + (month / xMax) * plotW
  const yAt = (value: number) => plotBottom - (value / yMax) * plotH

  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 1
  ctx.setLineDash([3, 3])
  for (const tick of spec.yTicks) {
    const y = yAt(tick)
    ctx.beginPath()
    ctx.moveTo(plotLeft, y)
    ctx.lineTo(plotRight, y)
    ctx.stroke()
  }
  for (const tick of spec.xTicks) {
    const x = xAt(tick)
    ctx.beginPath()
    ctx.moveTo(x, plotTop)
    ctx.lineTo(x, plotBottom)
    ctx.stroke()
  }
  ctx.setLineDash([])

  ctx.strokeStyle = '#9ca3af'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(plotLeft, plotTop)
  ctx.lineTo(plotLeft, plotBottom)
  ctx.lineTo(plotRight, plotBottom)
  ctx.stroke()

  ctx.fillStyle = '#6b7280'
  ctx.font = '11px Arial, Helvetica, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (const tick of spec.xTicks) {
    ctx.fillText(Number(tick).toFixed(1), xAt(tick), plotBottom + 8)
  }

  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (const tick of spec.yTicks) {
    const label = Number.isInteger(tick) ? String(tick) : tick.toFixed(1)
    ctx.fillText(label, plotLeft - 8, yAt(tick))
  }

  ctx.textAlign = 'center'
  ctx.fillText(spec.xLabel, (plotLeft + plotRight) / 2, height - 18)
  ctx.save()
  ctx.translate(14, (plotTop + plotBottom) / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText(spec.yLabel, 0, 0)
  ctx.restore()

  const points = spec.points
    .filter((p) => Number.isFinite(p.month) && Number.isFinite(p.marketKgPerMonth))
    .sort((a, b) => a.month - b.month)

  if (points.length > 0) {
    ctx.strokeStyle = spec.color
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    points.forEach((point, index) => {
      const x = xAt(point.month)
      const y = yAt(point.marketKgPerMonth)
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
  }

  return canvas
}

export function parseProfileChartSpec(wrap: HTMLElement, width: number, height: number): ProfileChartSpec | null {
  const raw = wrap.getAttribute('data-pdf-spec')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Omit<ProfileChartSpec, 'width' | 'height'>
    if (!parsed.points?.length) return null
    return {
      ...parsed,
      width,
      height,
      color: parsed.color || CHART.sd,
    }
  } catch {
    return null
  }
}
