/** «Красивый» шаг сетки по порядку величины. */
export function niceStep(rough: number): number {
  if (!Number.isFinite(rough) || rough <= 0) return 1
  const exp = Math.floor(Math.log10(rough))
  const base = 10 ** exp
  const f = rough / base
  if (f <= 1) return base
  if (f <= 2) return 2 * base
  if (f <= 5) return 5 * base
  return 10 * base
}

export interface AxisConfig {
  domain: [number, number]
  ticks: number[]
}

/** Ось от 0 с плотными делениями (для урожая кг/м²/год или кг). */
export function buildDenseAxis(
  maxValue: number,
  options?: { tickCount?: number; minStep?: number; padRatio?: number },
): AxisConfig {
  const tickCount = options?.tickCount ?? 8
  const minStep = options?.minStep ?? 1
  const padRatio = options?.padRatio ?? 1.1
  const padded = Math.max(maxValue * padRatio, minStep)
  const step = Math.max(minStep, niceStep(padded / tickCount))
  const top = Math.ceil(padded / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + step * 0.001; v += step) {
    ticks.push(Number(v.toFixed(4)))
  }
  return { domain: [0, top], ticks }
}

/** Линейные деления для оси цикла (месяцы). */
export function buildMonthAxisTicks(maxMonth: number, step = 1): number[] {
  const top = Math.ceil(maxMonth / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + 0.001; v += step) {
    ticks.push(Number(v.toFixed(2)))
  }
  return ticks
}

export function maxOf(values: number[]): number {
  if (!values.length) return 0
  return Math.max(...values.filter((v) => Number.isFinite(v)))
}

export function compareDualAxes(sdMax: number, dnMax: number): { sd: AxisConfig; dn: AxisConfig } {
  return {
    sd: buildDenseAxis(sdMax, { tickCount: 7, minStep: 5 }),
    dn: buildDenseAxis(dnMax, { tickCount: 6, minStep: 2 }),
  }
}
