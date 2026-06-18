import { buildDnCycleWaveProfile, buildDnMonthlyCalendar, roundTo } from './calculatorEngine'
import type { CalculatorState, CropResult } from './calculatorTypes'
import type { Scenario } from './types'

export const MONTH_LABELS = [
  'Янв',
  'Фев',
  'Мар',
  'Апр',
  'Май',
  'Июн',
  'Июл',
  'Авг',
  'Сен',
  'Окт',
  'Ноя',
  'Дек',
] as const

export const SCENARIO_LABELS: Record<Scenario, string> = {
  min: 'Мин',
  avg: 'Средний',
  max: 'Макс',
}

export function buildFarmMonthlyData(
  state: CalculatorState,
  sdResult: CropResult,
  scenario: Scenario,
): Array<Record<string, string | number>> {
  const area = state.farmAreaM2
  const sdMonthlyShelf = sdResult[scenario].marketShelfM2PerYear / 12
  const dnCalendar = buildDnMonthlyCalendar(state, scenario)
  return MONTH_LABELS.map((month, index) => {
    const row: Record<string, string | number> = { month }
    if (state.cropType === 'SD' || state.cropType === 'both') {
      row.КСД = roundTo(sdMonthlyShelf * area, 1)
    }
    if (state.cropType === 'DN' || state.cropType === 'both') {
      row.НСД = roundTo(dnCalendar[index] * area, 1)
    }
    return row
  })
}

export function buildDnCalendarChartData(state: CalculatorState, scenario: Scenario) {
  const dnCalendar = buildDnMonthlyCalendar(state, scenario)
  return MONTH_LABELS.map((month, index) => ({
    month,
    marketKg: roundTo(dnCalendar[index], 2),
  }))
}

export function buildDnProfileChartData(state: CalculatorState, scenario: Scenario) {
  return buildDnCycleWaveProfile(state, scenario)
}
