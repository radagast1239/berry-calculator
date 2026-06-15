import type { CalculatorState, CropResult } from './calculatorTypes'
import type { Triple } from './types'

export interface SensitivityLine {
  id: string
  label: string
  sd: number
  dn: number
  sdFarmKg: number
  dnFarmKg: number
}

const scaleTriple = (triple: Triple, factor: number): Triple => ({
  min: triple.min * factor,
  avg: triple.avg * factor,
  max: triple.max * factor,
})

export function withSensitivityAdjustments(
  state: CalculatorState,
  adjustments: { densityFactor?: number; yieldFactor?: number },
): CalculatorState {
  const densityFactor = adjustments.densityFactor ?? 1
  const yieldFactor = adjustments.yieldFactor ?? 1
  return {
    ...state,
    density: state.density * densityFactor,
    sdYieldPerPlant: scaleTriple(state.sdYieldPerPlant, yieldFactor),
    dnYieldPerPlant: scaleTriple(state.dnYieldPerPlant, yieldFactor),
  }
}

export function buildSensitivityLines(
  state: CalculatorState,
  pct: number,
  calculateCrop: (state: CalculatorState, crop: 'SD' | 'DN') => CropResult,
): SensitivityLine[] {
  const factor = pct / 100
  const baseSd = calculateCrop(state, 'SD').avg
  const baseDn = calculateCrop(state, 'DN').avg

  const rows: Array<{ id: string; label: string; densityFactor: number; yieldFactor: number }> = [
    { id: 'base', label: 'Базовый расчёт', densityFactor: 1, yieldFactor: 1 },
    { id: 'density-low', label: `Плотность −${pct}%`, densityFactor: 1 - factor, yieldFactor: 1 },
    { id: 'density-high', label: `Плотность +${pct}%`, densityFactor: 1 + factor, yieldFactor: 1 },
    { id: 'yield-low', label: `Урожай с куста −${pct}%`, densityFactor: 1, yieldFactor: 1 - factor },
    { id: 'yield-high', label: `Урожай с куста +${pct}%`, densityFactor: 1, yieldFactor: 1 + factor },
    {
      id: 'both-low',
      label: `Плотность и урожай −${pct}%`,
      densityFactor: 1 - factor,
      yieldFactor: 1 - factor,
    },
    {
      id: 'both-high',
      label: `Плотность и урожай +${pct}%`,
      densityFactor: 1 + factor,
      yieldFactor: 1 + factor,
    },
  ]

  return rows.map((row) => {
    const adjusted = withSensitivityAdjustments(state, {
      densityFactor: row.densityFactor,
      yieldFactor: row.yieldFactor,
    })
    const sdResult = row.id === 'base' ? baseSd : calculateCrop(adjusted, 'SD').avg
    const dnResult = row.id === 'base' ? baseDn : calculateCrop(adjusted, 'DN').avg
    return {
      id: row.id,
      label: row.label,
      sd: sdResult.marketMainM2PerYear,
      dn: dnResult.marketMainM2PerYear,
      sdFarmKg: sdResult.farmMarketAnnualKg,
      dnFarmKg: dnResult.farmMarketAnnualKg,
    }
  })
}
