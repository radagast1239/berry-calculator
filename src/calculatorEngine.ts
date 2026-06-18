import type { CalculatorState, CropResult, ScenarioResult } from './calculatorTypes'
import type { Scenario } from './types'

const SCENARIOS: Scenario[] = ['min', 'avg', 'max']

export const clamp = (value: number, min: number, max?: number): number => {
  if (Number.isNaN(value)) return min
  if (value < min) return min
  if (max !== undefined && value > max) return max
  return value
}

export const roundTo = (value: number, digits: number): number => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export const isOrdered = (value: { min: number; avg: number; max: number }): boolean =>
  value.min <= value.avg && value.avg <= value.max

export const getCoreFactor = (state: CalculatorState): number => state.kLosses * state.kPests

export const computeScenarioRaw = (
  state: CalculatorState,
  crop: 'SD' | 'DN',
  scenario: Scenario,
): { grossShelfM2PerYear: number; grossShelfM2PerCycle: number } => {
  const yieldPerPlant = crop === 'SD' ? state.sdYieldPerPlant[scenario] : state.dnYieldPerPlant[scenario]
  const cycleMonths = crop === 'SD' ? state.sdCycleMonths[scenario] : state.dnCycleMonths[scenario]
  const turnaround = crop === 'DN' ? state.dnTurnaroundMonths[scenario] : 0
  const cyclesPerYear = 12 / (cycleMonths + turnaround)

  if (crop === 'DN' && state.dnManualProfileEnabled) {
    const avgYield = Math.max(state.dnYieldPerPlant.avg, 0.0001)
    const scenarioScale = yieldPerPlant / avgYield
    const annualPlantYield = state.dnManualMonthlyPlantYield.reduce((sum, value) => sum + value, 0) * scenarioScale
    const grossShelfM2PerYear = annualPlantYield * state.density
    const grossShelfM2PerCycle = cyclesPerYear > 0 ? grossShelfM2PerYear / cyclesPerYear : 0
    return { grossShelfM2PerYear, grossShelfM2PerCycle }
  }

  const grossShelfM2PerCycle = yieldPerPlant * state.density
  const grossShelfM2PerYear = grossShelfM2PerCycle * cyclesPerYear
  return { grossShelfM2PerYear, grossShelfM2PerCycle }
}

export const calculateCrop = (state: CalculatorState, crop: 'SD' | 'DN'): CropResult =>
  SCENARIOS.reduce((acc, scenario) => {
    const yieldPerPlant = crop === 'SD' ? state.sdYieldPerPlant[scenario] : state.dnYieldPerPlant[scenario]
    const cycleMonths = crop === 'SD' ? state.sdCycleMonths[scenario] : state.dnCycleMonths[scenario]
    const turnaroundMonths = crop === 'DN' ? state.dnTurnaroundMonths[scenario] : 0
    const cyclesPerYear = 12 / (cycleMonths + turnaroundMonths)

    const raw = computeScenarioRaw(state, crop, scenario)
    const grossShelfM2PerCycle = raw.grossShelfM2PerCycle
    const grossShelfM2PerYear = raw.grossShelfM2PerYear
    const grossPlantPerYear = state.density > 0 ? grossShelfM2PerYear / state.density : 0
    const coreFactor = getCoreFactor(state)
    const bioShelfM2PerYear = grossShelfM2PerYear * coreFactor
    const marketShelfM2PerYear = bioShelfM2PerYear * state.packout
    const marketM2PerYear = marketShelfM2PerYear
    const marketM2PerMonth = marketM2PerYear / 12
    const farmMarketAnnualKg = marketShelfM2PerYear * state.farmAreaM2
    const farmMarketMonthlyKg = farmMarketAnnualKg / 12

    let productiveMonths: number | null = null
    let productiveMonthMarketKg: number | null = null
    let productiveMonthError: string | null = null

    if (crop === 'DN') {
      if (state.dnManualProfileEnabled) {
        const avgYield = Math.max(state.dnYieldPerPlant.avg, 0.0001)
        const scenarioScale = yieldPerPlant / avgYield
        const monthly = state.dnManualMonthlyPlantYield.map(
          (value) => value * scenarioScale * state.density * coreFactor * state.packout,
        )
        const productive = monthly.filter((value) => value > 0.0001)
        productiveMonths = productive.length
        if (productiveMonths === 0) {
          productiveMonthError = 'В ручном профиле НСД нет месяцев с урожаем.'
        } else {
          productiveMonthMarketKg = productive.reduce((sum, value) => sum + value, 0) / productiveMonths
        }
      } else {
        productiveMonths = cycleMonths - state.dnEstablishMonths[scenario]
        if (productiveMonths <= 0) {
          productiveMonthError = 'Фаза установления должна быть короче цикла НСД.'
        } else {
          const cycleMarketShelf = grossShelfM2PerCycle * coreFactor * state.packout
          productiveMonthMarketKg = cycleMarketShelf / productiveMonths
        }
      }
    }

    acc[scenario] = {
      cyclesPerYear,
      grossPlantPerYear,
      grossShelfM2PerCycle,
      grossShelfM2PerYear,
      bioShelfM2PerYear,
      marketShelfM2PerYear,
      marketM2PerYear,
      marketM2PerMonth,
      farmMarketAnnualKg,
      farmMarketMonthlyKg,
      productiveMonths,
      productiveMonthMarketKg,
      productiveMonthError,
    }

    return acc
  }, {} as CropResult)

export interface PercentileResult {
  p10: number
  p50: number
  p90: number
}

const sampleTriangular = (min: number, mode: number, max: number): number => {
  if (min === max) return min
  const u = Math.random()
  const c = (mode - min) / (max - min)
  if (u < c) return min + Math.sqrt(u * (max - min) * (mode - min))
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode))
}

const quantile = (sorted: number[], q: number): number => {
  if (sorted.length === 0) return 0
  const index = (sorted.length - 1) * q
  const lo = Math.floor(index)
  const hi = Math.ceil(index)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo)
}

export const simulatePercentiles = (
  state: CalculatorState,
  crop: 'SD' | 'DN',
  iterations = 1200,
): PercentileResult => {
  const values: number[] = []
  const uncertainty = state.uncertaintyPct / 100

  for (let i = 0; i < iterations; i += 1) {
    const sampledYield = sampleTriangular(
      crop === 'SD' ? state.sdYieldPerPlant.min : state.dnYieldPerPlant.min,
      crop === 'SD' ? state.sdYieldPerPlant.avg : state.dnYieldPerPlant.avg,
      crop === 'SD' ? state.sdYieldPerPlant.max : state.dnYieldPerPlant.max,
    )
    const sampledCycle = sampleTriangular(
      crop === 'SD' ? state.sdCycleMonths.min : state.dnCycleMonths.min,
      crop === 'SD' ? state.sdCycleMonths.avg : state.dnCycleMonths.avg,
      crop === 'SD' ? state.sdCycleMonths.max : state.dnCycleMonths.max,
    )
    const sampledTurnaround =
      crop === 'DN'
        ? sampleTriangular(
            state.dnTurnaroundMonths.min,
            state.dnTurnaroundMonths.avg,
            state.dnTurnaroundMonths.max,
          )
        : 0

    const cyclesPerYear = 12 / (sampledCycle + sampledTurnaround)
    let grossShelf = sampledYield * state.density * cyclesPerYear
    if (crop === 'DN' && state.dnManualProfileEnabled) {
      const avgYield = Math.max(state.dnYieldPerPlant.avg, 0.0001)
      const scenarioScale = sampledYield / avgYield
      const manualAnnualPlant =
        state.dnManualMonthlyPlantYield.reduce((sum, value) => sum + value, 0) * scenarioScale
      grossShelf = manualAnnualPlant * state.density
    }

    const fluctuate = (value: number, spread: number) =>
      clamp(value * (1 + (Math.random() * 2 - 1) * spread), 0.3, 1.2)
    const kLosses = fluctuate(state.kLosses, uncertainty)
    const kPests = fluctuate(state.kPests, uncertainty)
    const packout = clamp(state.packout * (1 + (Math.random() * 2 - 1) * uncertainty * 0.7), 0.4, 1)
    const marketShelf = grossShelf * kLosses * kPests * packout
    values.push(marketShelf)
  }

  values.sort((a, b) => a - b)
  return {
    p10: quantile(values, 0.1),
    p50: quantile(values, 0.5),
    p90: quantile(values, 0.9),
  }
}

const getDnWaveShares = (state: CalculatorState, scenario: Scenario): number[] => {
  const wavesCount = state.dnWaves[scenario] >= 2.5 ? 3 : 2
  if (wavesCount === 2) {
    const wave1 = clamp(state.dnWave1Share[scenario], 0.1, 0.9)
    return [wave1, 1 - wave1]
  }

  const w1 = clamp(state.dnWave1Share[scenario], 0, 1)
  const w2 = clamp(state.dnWave2Share[scenario], 0, 1)
  const w3 = Math.max(0, 1 - w1 - w2)
  const total = w1 + w2 + w3 || 1
  return [w1 / total, w2 / total, w3 / total]
}

/** Форма сезонности НСД: перекрывающиеся когорты + волны, размазанные по месяцам (не в одну точку). */
function buildDnCalendarShape(
  establishMonths: number,
  fruitingMonths: number,
  shares: number[],
  turnaroundMonths: number,
): number[] {
  const months = new Array(12).fill(0)
  if (fruitingMonths <= 0 || !shares.length) return months

  const waveCenters = shares.length === 2 ? [0.28, 0.72] : [0.2, 0.52, 0.82]
  const waveWidthMonths = Math.max(fruitingMonths / (shares.length * 2.5), 0.75)
  // Новая когорта — по паузе между сменами (оборот), иначе слишком частый посев сглаживает волны.
  const cohortStagger = Math.max(turnaroundMonths, 2)
  const cohortStartMin = -establishMonths - fruitingMonths
  const cohortStartMax = 12 + fruitingMonths

  for (let cohortStart = cohortStartMin; cohortStart <= cohortStartMax; cohortStart += cohortStagger) {
    shares.forEach((share, waveIndex) => {
      const peakCalendarMonth = cohortStart + establishMonths + fruitingMonths * waveCenters[waveIndex]
      for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
        const dist = (monthIndex + 0.5 - peakCalendarMonth) / waveWidthMonths
        months[monthIndex] += share * Math.exp(-0.5 * dist * dist)
      }
    })
  }

  return months
}

export const buildDnMonthlyCalendar = (state: CalculatorState, scenario: Scenario): number[] => {
  const months = new Array(12).fill(0)
  if (state.dnManualProfileEnabled) {
    const avgYield = Math.max(state.dnYieldPerPlant.avg, 0.0001)
    const scenarioScale = state.dnYieldPerPlant[scenario] / avgYield
    const factor = getCoreFactor(state) * state.packout * state.density
    return state.dnManualMonthlyPlantYield.map((value) => value * scenarioScale * factor)
  }

  const cycleMonths = state.dnCycleMonths[scenario]
  const establish = state.dnEstablishMonths[scenario]
  const fruitingMonths = cycleMonths - establish
  if (fruitingMonths <= 0) return months

  const shares = getDnWaveShares(state, scenario)
  const turnaround = state.dnTurnaroundMonths[scenario]
  const shape = buildDnCalendarShape(establish, fruitingMonths, shares, turnaround)
  const shapeSum = shape.reduce((sum, value) => sum + value, 0)
  if (shapeSum <= 0) return months

  const marketAnnualShelf =
    computeScenarioRaw(state, 'DN', scenario).grossShelfM2PerYear * getCoreFactor(state) * state.packout

  return shape.map((weight) => roundTo((marketAnnualShelf * weight) / shapeSum, 4))
}

export const buildDnCycleWaveProfile = (
  state: CalculatorState,
  scenario: Scenario,
): Array<{ month: number; marketKgPerMonth: number }> => {
  if (state.dnManualProfileEnabled) {
    const avgYield = Math.max(state.dnYieldPerPlant.avg, 0.0001)
    const scenarioScale = state.dnYieldPerPlant[scenario] / avgYield
    const factor = getCoreFactor(state) * state.packout * state.density
    return state.dnManualMonthlyPlantYield.map((value, index) => ({
      month: index + 1,
      marketKgPerMonth: roundTo(value * scenarioScale * factor, 2),
    }))
  }

  const cycleMonths = state.dnCycleMonths[scenario]
  const establish = state.dnEstablishMonths[scenario]
  const productiveMonths = cycleMonths - establish
  if (productiveMonths <= 0) return []

  const grossCycle = state.dnYieldPerPlant[scenario] * state.density
  const marketCycle = grossCycle * getCoreFactor(state) * state.packout
  const shares = getDnWaveShares(state, scenario)
  const centers = shares.length === 2 ? [0.28, 0.78] : [0.18, 0.5, 0.82]
  const widths = shares.length === 2 ? [0.16, 0.14] : [0.14, 0.12, 0.12]
  const step = Math.max(0.1, cycleMonths / 40)

  const profileWeights: Array<{ month: number; weight: number }> = []
  let integral = 0

  for (let t = 0; t <= cycleMonths + 0.0001; t += step) {
    let weight = 0
    if (t >= establish) {
      const progress = clamp((t - establish) / productiveMonths, 0, 1)
      for (let i = 0; i < shares.length; i += 1) {
        const distance = (progress - centers[i]) / widths[i]
        weight += shares[i] * Math.exp(-0.5 * distance * distance)
      }
    }
    profileWeights.push({ month: t, weight })
    integral += weight * step
  }

  const scale = integral > 0 ? marketCycle / integral : 0
  return profileWeights.map((point) => ({
    month: roundTo(point.month, 1),
    marketKgPerMonth: roundTo(point.weight * scale, 2),
  }))
}

export function sumFarmKgForScenario(
  cropType: CalculatorState['cropType'],
  sd: ScenarioResult,
  dn: ScenarioResult,
): { annualKg: number; monthlyKg: number } {
  let annualKg = 0
  if (cropType === 'SD' || cropType === 'both') annualKg += sd.farmMarketAnnualKg
  if (cropType === 'DN' || cropType === 'both') annualKg += dn.farmMarketAnnualKg
  return { annualKg, monthlyKg: annualKg / 12 }
}
