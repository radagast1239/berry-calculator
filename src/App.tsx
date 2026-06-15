import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'
import type { AreaBasis, CropType, Scenario, Triple } from './types'
import { AREA_BASIS_BUTTON_LABELS, AREA_BASIS_GENITIVE, AREA_BASIS_SHORT } from './types'
import type { CalculatorState, CropResult } from './calculatorTypes'
import { migrateCalculatorState, MODEL_VERSION, parseModelVersion } from './modelVersion'
import { buildSensitivityLines } from './sensitivity'
import { PdfExportDialog } from './PdfExportDialog'
import { exportSectionsToPdf } from './pdfExport'
import {
  BENCHMARK_LEVEL_LABELS,
  FIELD_HINTS,
  getBenchmarkLevel,
  HintLabel,
  QrModal,
  SetupWizard,
  StickySummary,
  Toast,
  useIsMobileGuide,
  useStickyVisible,
  type WizardStep,
} from './uiHelpers'

type TripleField =
  | 'sdYieldPerPlant'
  | 'sdCycleMonths'
  | 'dnYieldPerPlant'
  | 'dnCycleMonths'
  | 'dnTurnaroundMonths'
  | 'dnWaves'
  | 'dnEstablishMonths'
  | 'dnWave1Share'
  | 'dnWave2Share'
  | 'berryMassG'

type QualityField = 'kLosses' | 'kPests' | 'packout'

interface PercentileResult {
  p10: number
  p50: number
  p90: number
}

const SCENARIOS: Scenario[] = ['min', 'avg', 'max']
const MONTH_LABELS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

const SCENARIO_LABELS: Record<Scenario, string> = {
  min: 'Мин',
  avg: 'Средний',
  max: 'Макс',
}

const BENCHMARKS = {
  SD: { confirmed: [32, 40] as const, ceiling: [40, 48] as const, max: 60 },
  DN: { confirmed: [34, 41] as const, ceiling: [40, 60] as const, max: 70 },
}

const LOGO_SRC = `${import.meta.env.BASE_URL}daogreen-logo.svg`

const DEFAULT_STATE: CalculatorState = {
  cropType: 'both',
  areaBasis: 'shelf',
  density: 20,
  tiers: 8,
  farmAreaM2: 1,
  kLosses: 1,
  kPests: 1,
  packout: 1,
  uncertaintyPct: 8,
  sdYieldPerPlant: { min: 0.4, avg: 0.5, max: 0.6 },
  sdCycleMonths: { min: 3, avg: 3, max: 3 },
  dnYieldPerPlant: { min: 1, avg: 1.25, max: 1.5 },
  dnCycleMonths: { min: 6, avg: 6, max: 6 },
  dnTurnaroundMonths: { min: 0.2, avg: 0.2, max: 0.2 },
  dnWaves: { min: 2, avg: 2.5, max: 3 },
  dnEstablishMonths: { min: 2, avg: 1.75, max: 1.5 },
  dnWave1Share: { min: 0.55, avg: 0.45, max: 0.4 },
  dnWave2Share: { min: 0.45, avg: 0.35, max: 0.35 },
  dnManualProfileEnabled: false,
  dnManualMonthlyPlantYield: [0, 0, 0.06, 0.14, 0.2, 0.14, 0.06, 0.06, 0.14, 0.2, 0.14, 0.06],
  berryMassG: { min: 8, avg: 11, max: 15 },
}

const clamp = (value: number, min: number, max?: number): number => {
  if (Number.isNaN(value)) return min
  if (value < min) return min
  if (max !== undefined && value > max) return max
  return value
}

const roundTo = (value: number, digits: number): number => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const formatValue = (value: number | null | undefined, digits = 1): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return roundTo(value, digits).toFixed(digits)
}

const normalizeFactor = (value: number, min: number, max: number): number =>
  roundTo(clamp(value, min, max), 3)

const parseNumber = (
  params: URLSearchParams,
  key: string,
  fallback: number,
  min: number,
  max?: number,
): number => {
  const raw = params.get(key)
  if (raw === null) return fallback
  return clamp(Number(raw), min, max)
}

const parseTriple = (
  params: URLSearchParams,
  key: string,
  fallback: Triple,
  min: number,
  max?: number,
): Triple => ({
  min: parseNumber(params, `${key}_min`, fallback.min, min, max),
  avg: parseNumber(params, `${key}_avg`, fallback.avg, min, max),
  max: parseNumber(params, `${key}_max`, fallback.max, min, max),
})

const parseMonthlyProfile = (raw: string | null, fallback: number[]): number[] => {
  if (!raw) return [...fallback]
  const values = raw
    .split(',')
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .map((value) => clamp(value, 0, 5))

  if (values.length !== 12) return [...fallback]
  return values
}

const toSearchParams = (state: CalculatorState): URLSearchParams => {
  const params = new URLSearchParams()
  params.set('v', String(MODEL_VERSION))
  params.set('cropType', state.cropType)
  params.set('areaBasis', state.areaBasis)
  params.set('density', String(state.density))
  params.set('tiers', String(state.tiers))
  params.set('farmAreaM2', String(state.farmAreaM2))
  params.set('kLosses', String(state.kLosses))
  params.set('kPests', String(state.kPests))
  params.set('packout', String(state.packout))
  params.set('uncertaintyPct', String(state.uncertaintyPct))
  params.set('dnManualProfileEnabled', state.dnManualProfileEnabled ? '1' : '0')
  params.set(
    'dnManualMonthlyPlantYield',
    state.dnManualMonthlyPlantYield.map((value) => roundTo(value, 3)).join(','),
  )

  const triples: Array<[string, Triple]> = [
    ['sd_yieldPerPlant', state.sdYieldPerPlant],
    ['sd_cycleMonths', state.sdCycleMonths],
    ['dn_yieldPerPlant', state.dnYieldPerPlant],
    ['dn_cycleMonths', state.dnCycleMonths],
    ['dn_turnaroundMonths', state.dnTurnaroundMonths],
    ['dn_waves', state.dnWaves],
    ['dn_establishMonths', state.dnEstablishMonths],
    ['dn_wave1Share', state.dnWave1Share],
    ['dn_wave2Share', state.dnWave2Share],
    ['berryMassG', state.berryMassG],
  ]

  triples.forEach(([name, triple]) => {
    SCENARIOS.forEach((scenario) => {
      params.set(`${name}_${scenario}`, String(triple[scenario]))
    })
  })

  return params
}

const parseStateFromUrl = (): CalculatorState => {
  const params = new URLSearchParams(window.location.search)
  const modelVersion = parseModelVersion(params)
  const cropTypeRaw = params.get('cropType')
  const areaBasisRaw = params.get('areaBasis')

  const cropType: CropType =
    cropTypeRaw === 'SD' || cropTypeRaw === 'DN' || cropTypeRaw === 'both'
      ? cropTypeRaw
      : DEFAULT_STATE.cropType
  const areaBasis: AreaBasis = areaBasisRaw === 'floor' ? 'floor' : 'shelf'

  const legacyReality = parseNumber(params, 'realityFactor', 1, 0.3, 1)
  const legacyPerFactor = roundTo(Math.sqrt(legacyReality), 3)

  const parsed: CalculatorState = {
    cropType,
    areaBasis,
    density: parseNumber(params, 'density', DEFAULT_STATE.density, 1, 90),
    tiers: parseNumber(params, 'tiers', DEFAULT_STATE.tiers, 1, 30),
    farmAreaM2: parseNumber(params, 'farmAreaM2', DEFAULT_STATE.farmAreaM2, 1),
    kLosses: normalizeFactor(
      parseNumber(
      params,
      'kLosses',
      DEFAULT_STATE.kLosses,
      0.3,
      1,
    ),
      0.3,
      1,
    ),
    kPests: normalizeFactor(
      parseNumber(
      params,
      'kPests',
      DEFAULT_STATE.kPests,
      0.3,
      1,
    ),
      0.3,
      1,
    ),
    packout: normalizeFactor(parseNumber(params, 'packout', DEFAULT_STATE.packout, 0.5, 1), 0.5, 1),
    uncertaintyPct: parseNumber(params, 'uncertaintyPct', DEFAULT_STATE.uncertaintyPct, 0, 30),
    sdYieldPerPlant: parseTriple(params, 'sd_yieldPerPlant', DEFAULT_STATE.sdYieldPerPlant, 0.01),
    sdCycleMonths: parseTriple(params, 'sd_cycleMonths', DEFAULT_STATE.sdCycleMonths, 0.1),
    dnYieldPerPlant: parseTriple(params, 'dn_yieldPerPlant', DEFAULT_STATE.dnYieldPerPlant, 0.01),
    dnCycleMonths: parseTriple(params, 'dn_cycleMonths', DEFAULT_STATE.dnCycleMonths, 0.1),
    dnTurnaroundMonths: parseTriple(
      params,
      'dn_turnaroundMonths',
      DEFAULT_STATE.dnTurnaroundMonths,
      0,
    ),
    dnWaves: parseTriple(params, 'dn_waves', DEFAULT_STATE.dnWaves, 1),
    dnEstablishMonths: parseTriple(
      params,
      'dn_establishMonths',
      DEFAULT_STATE.dnEstablishMonths,
      0.1,
    ),
    dnWave1Share: parseTriple(params, 'dn_wave1Share', DEFAULT_STATE.dnWave1Share, 0, 1),
    dnWave2Share: parseTriple(params, 'dn_wave2Share', DEFAULT_STATE.dnWave2Share, 0, 1),
    dnManualProfileEnabled: params.get('dnManualProfileEnabled') === '1',
    dnManualMonthlyPlantYield: parseMonthlyProfile(
      params.get('dnManualMonthlyPlantYield'),
      DEFAULT_STATE.dnManualMonthlyPlantYield,
    ),
    berryMassG: parseTriple(params, 'berryMassG', DEFAULT_STATE.berryMassG, 1),
    // Legacy compatibility: if URL has only realityFactor, split it into remaining quality coefficients.
    ...(params.get('kLosses') === null && params.get('kPests') === null
      ? {
          kLosses: legacyPerFactor,
          kPests: legacyPerFactor,
        }
      : {}),
  }

  return migrateCalculatorState(parsed, modelVersion)
}

const isOrdered = (value: Triple): boolean => value.min <= value.avg && value.avg <= value.max

const getCoreFactor = (state: CalculatorState): number => state.kLosses * state.kPests

const computeScenarioRaw = (
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

const calculateCrop = (state: CalculatorState, crop: 'SD' | 'DN'): CropResult =>
  SCENARIOS.reduce((acc, scenario) => {
    const yieldPerPlant = crop === 'SD' ? state.sdYieldPerPlant[scenario] : state.dnYieldPerPlant[scenario]
    const cycleMonths = crop === 'SD' ? state.sdCycleMonths[scenario] : state.dnCycleMonths[scenario]
    const turnaroundMonths = crop === 'DN' ? state.dnTurnaroundMonths[scenario] : 0
    const cyclesPerYear = 12 / (cycleMonths + turnaroundMonths)

    const raw = computeScenarioRaw(state, crop, scenario)
    const grossShelfM2PerCycle = raw.grossShelfM2PerCycle
    const grossShelfM2PerYear = raw.grossShelfM2PerYear
    const grossPlantPerYear = state.density > 0 ? grossShelfM2PerYear / state.density : 0
    const grossFloorM2PerYear = grossShelfM2PerYear * state.tiers
    const coreFactor = getCoreFactor(state)
    const bioShelfM2PerYear = grossShelfM2PerYear * coreFactor
    const marketShelfM2PerYear = bioShelfM2PerYear * state.packout
    const marketFloorM2PerYear = marketShelfM2PerYear * state.tiers
    const marketMainM2PerYear =
      state.areaBasis === 'shelf' ? marketShelfM2PerYear : marketFloorM2PerYear
    const marketMainM2PerMonth = marketMainM2PerYear / 12
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
      grossFloorM2PerYear,
      bioShelfM2PerYear,
      marketShelfM2PerYear,
      marketFloorM2PerYear,
      marketMainM2PerYear,
      marketMainM2PerMonth,
      farmMarketAnnualKg,
      farmMarketMonthlyKg,
      productiveMonths,
      productiveMonthMarketKg,
      productiveMonthError,
    }

    return acc
  }, {} as CropResult)

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

const simulatePercentiles = (
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
    const marketMain = state.areaBasis === 'shelf' ? marketShelf : marketShelf * state.tiers
    values.push(marketMain)
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

const buildDnMonthlyCalendar = (state: CalculatorState, scenario: Scenario): number[] => {
  const months = new Array(12).fill(0)
  if (state.dnManualProfileEnabled) {
    const avgYield = Math.max(state.dnYieldPerPlant.avg, 0.0001)
    const scenarioScale = state.dnYieldPerPlant[scenario] / avgYield
    const factor = getCoreFactor(state) * state.packout * state.density
    return state.dnManualMonthlyPlantYield.map((value) => value * scenarioScale * factor)
  }

  const cycleMonths = state.dnCycleMonths[scenario]
  const turnaround = state.dnTurnaroundMonths[scenario]
  const cycleSpan = cycleMonths + turnaround
  const productiveMonths = cycleMonths - state.dnEstablishMonths[scenario]
  if (productiveMonths <= 0) return months

  const grossCycle = state.dnYieldPerPlant[scenario] * state.density
  const marketCycle = grossCycle * getCoreFactor(state) * state.packout

  const shares = getDnWaveShares(state, scenario)
  const centers = shares.length === 2 ? [0.3, 0.78] : [0.2, 0.55, 0.85]

  for (let cycleStart = -cycleSpan; cycleStart < 12 + cycleSpan; cycleStart += cycleSpan) {
    for (let waveIndex = 0; waveIndex < shares.length; waveIndex += 1) {
      const waveYield = marketCycle * shares[waveIndex]
      const monthPosition =
        cycleStart + state.dnEstablishMonths[scenario] + productiveMonths * centers[waveIndex]
      if (monthPosition >= 0 && monthPosition < 12) {
        const monthIndex = Math.floor(monthPosition)
        months[monthIndex] += waveYield
      }
    }
  }

  return months
}

const buildDnCycleWaveProfile = (
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

interface TripleInputsProps {
  title: string
  unit: string
  values: Triple
  min: number
  max?: number
  step: number
  hint?: string
  clientMode?: boolean
  onChange: (scenario: Scenario, value: number) => void
}

function TripleInputs({
  title,
  unit,
  values,
  min,
  max,
  step,
  hint,
  clientMode = false,
  onChange,
}: TripleInputsProps) {
  const scenarios = clientMode ? (['avg'] as Scenario[]) : SCENARIOS
  return (
    <div className="triple-inputs">
      <p className="field-title">
        <HintLabel label={title} hint={hint} /> <span>{unit}</span>
      </p>
      <div className={`triple-grid ${clientMode ? 'triple-grid-client' : ''}`}>
        {scenarios.map((scenario) => (
          <label key={scenario} className="field triple-field">
            <span className="scenario-label">{SCENARIO_LABELS[scenario]}</span>
            <input
              type="number"
              className="triple-input"
              value={values[scenario]}
              min={min}
              max={max}
              step={step}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (!Number.isNaN(value)) onChange(scenario, clamp(value, min, max))
              }}
            />
          </label>
        ))}
      </div>
    </div>
  )
}

function BenchmarkBar({ crop, value }: { crop: 'SD' | 'DN'; value: number }) {
  const benchmark = BENCHMARKS[crop]
  const level = getBenchmarkLevel(crop, value, BENCHMARKS)
  const max = benchmark.max
  const toPercent = (raw: number): number => Math.min((raw / max) * 100, 100)
  const confirmedStart = toPercent(benchmark.confirmed[0])
  const confirmedWidth = toPercent(benchmark.confirmed[1]) - confirmedStart
  const ceilingStart = toPercent(benchmark.ceiling[0])
  const ceilingWidth = toPercent(benchmark.ceiling[1]) - ceilingStart
  const marker = toPercent(value)

  return (
    <div className={`benchmark benchmark-${level}`}>
      <div className="benchmark-scale">
        <div
          className="segment confirmed"
          style={{ left: `${confirmedStart}%`, width: `${confirmedWidth}%` }}
        />
        <div
          className="segment ceiling"
          style={{ left: `${ceilingStart}%`, width: `${ceilingWidth}%` }}
        />
        <div className="marker" style={{ left: `${marker}%` }} />
      </div>
      <p>
        {BENCHMARK_LEVEL_LABELS[level]} · ориентир: подтверждено {benchmark.confirmed[0]}-{benchmark.confirmed[1]} ·
        потолок {benchmark.ceiling[0]}-{benchmark.ceiling[1]} кг/м²/год (поверхность)
      </p>
    </div>
  )
}

function ScenarioCards({
  crop,
  result,
  areaBasis,
  clientMode = false,
}: {
  crop: 'SD' | 'DN'
  result: CropResult
  areaBasis: AreaBasis
  clientMode?: boolean
}) {
  const areaLabel = AREA_BASIS_GENITIVE[areaBasis]
  const cards = clientMode ? (['avg'] as Scenario[]) : SCENARIOS
  return (
    <div className={`scenario-cards ${clientMode ? 'scenario-cards-client' : ''}`}>
      {cards.map((scenario) => {
        const level = getBenchmarkLevel(crop, result[scenario].marketShelfM2PerYear, BENCHMARKS)
        return (
        <article className={`scenario-card scenario-${scenario} benchmark-card-${level}`} key={scenario}>
          <h4>{SCENARIO_LABELS[scenario]}</h4>
          <p className={`scenario-main benchmark-value-${level}`}>
            {formatValue(result[scenario].marketMainM2PerYear, 1)}
            <span> кг/м² {areaLabel} / год</span>
          </p>
          <p className="scenario-sub">
            Товарный: {formatValue(result[scenario].marketMainM2PerMonth, 1)} кг/м²/мес · валовый:{' '}
            {formatValue(
              areaBasis === 'shelf'
                ? result[scenario].grossShelfM2PerYear
                : result[scenario].grossFloorM2PerYear,
              1,
            )}{' '}
            кг/м²/год
          </p>
          <p className="scenario-sub">
            Циклов/год: {formatValue(result[scenario].cyclesPerYear, 2)} · с куста/год:{' '}
            {formatValue(result[scenario].grossPlantPerYear, 2)} кг
          </p>
          {crop === 'DN' && (
            <p className="scenario-sub">
              Продуктивный месяц: {formatValue(result[scenario].productiveMonthMarketKg, 2)} кг/м² поверхности
            </p>
          )}
          {result[scenario].productiveMonthError && (
            <p className="error-inline">{result[scenario].productiveMonthError}</p>
          )}
          <BenchmarkBar crop={crop} value={result[scenario].marketShelfM2PerYear} />
        </article>
      )})}
    </div>
  )
}

function ResultsTable({
  crop,
  title,
  result,
  areaBasis,
  clientMode = false,
}: {
  crop: 'SD' | 'DN'
  title: string
  result: CropResult
  areaBasis: AreaBasis
  clientMode?: boolean
}) {
  return (
    <section className="result-card">
      <h3>{title}</h3>
      <ScenarioCards crop={crop} result={result} areaBasis={areaBasis} clientMode={clientMode} />
      <div className={`table-wrap ${clientMode ? 'no-print-table' : ''}`}>
        <table>
          <thead>
            <tr>
              <th>Сценарий</th>
              <th>Циклов/год</th>
              <th>Валовый, кг/м² поверхности/год</th>
              <th>Биологический, кг/м² поверхности/год</th>
              <th>Товарный, кг/м² поверхности/год</th>
              <th>Товарный, кг/м² пола/год</th>
              <th>Ферма, товарный кг/год</th>
              <th>Ферма, товарный кг/мес</th>
            </tr>
          </thead>
          <tbody>
            {SCENARIOS.map((scenario) => (
              <tr key={scenario}>
                <td>{SCENARIO_LABELS[scenario]}</td>
                <td>{formatValue(result[scenario].cyclesPerYear, 2)}</td>
                <td>{formatValue(result[scenario].grossShelfM2PerYear, 1)}</td>
                <td>{formatValue(result[scenario].bioShelfM2PerYear, 1)}</td>
                <td>{formatValue(result[scenario].marketShelfM2PerYear, 1)}</td>
                <td>{formatValue(result[scenario].marketFloorM2PerYear, 1)}</td>
                <td>{formatValue(result[scenario].farmMarketAnnualKg, 1)}</td>
                <td>{formatValue(result[scenario].farmMarketMonthlyKg, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">
        В карточках основной показатель показывается для базы: {AREA_BASIS_GENITIVE[areaBasis]}.
      </p>
    </section>
  )
}

function App() {
  const [state, setStateRaw] = useState<CalculatorState>(() => parseStateFromUrl())
  const undoStack = useRef<CalculatorState[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [toast, setToast] = useState('')
  const [linkStatus, setLinkStatus] = useState('')
  const [calibrationStatus, setCalibrationStatus] = useState('Калибровка пока не выполнялась.')
  const [calendarScenario, setCalendarScenario] = useState<Scenario>('avg')
  const [clientMode, setClientMode] = useState(() => localStorage.getItem('berryClientMode') === '1')
  const [showQr, setShowQr] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(
    () => !localStorage.getItem('berryWizardDone') && !window.location.search,
  )
  const [wizardStep, setWizardStep] = useState<WizardStep>(0)
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false)
  const [pdfExporting, setPdfExporting] = useState(false)
  const [sensitivityPct, setSensitivityPct] = useState(10)
  const stickyVisible = useStickyVisible()
  const isMobileGuide = useIsMobileGuide()

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }, [])

  const setState = useCallback(
    (updater: CalculatorState | ((prev: CalculatorState) => CalculatorState)) => {
      setStateRaw((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        if (next !== prev) {
          undoStack.current = [...undoStack.current.slice(-24), prev]
          setCanUndo(undoStack.current.length > 0)
        }
        return next
      })
    },
    [],
  )

  const undo = useCallback(() => {
    const previous = undoStack.current.pop()
    if (!previous) return
    setCanUndo(undoStack.current.length > 0)
    setStateRaw(previous)
    showToast('Отменено последнее изменение.')
  }, [showToast])

  useEffect(() => {
    document.title = 'Калькулятор урожая клубники · Daogreen'
  }, [])

  useEffect(() => {
    localStorage.setItem('berryClientMode', clientMode ? '1' : '0')
  }, [clientMode])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo])

  const sdResult = useMemo(() => calculateCrop(state, 'SD'), [state])
  const dnResult = useMemo(() => calculateCrop(state, 'DN'), [state])
  const coreFactor = useMemo(() => getCoreFactor(state), [state])
  const totalMarketFactor = coreFactor * state.packout
  const dnManualAnnualPlant = useMemo(
    () => state.dnManualMonthlyPlantYield.reduce((sum, value) => sum + value, 0),
    [state.dnManualMonthlyPlantYield],
  )

  const uncertaintySD = useMemo(() => simulatePercentiles(state, 'SD'), [state])
  const uncertaintyDN = useMemo(() => simulatePercentiles(state, 'DN'), [state])

  const dnCalendar = useMemo(() => buildDnMonthlyCalendar(state, calendarScenario), [state, calendarScenario])
  const dnCalendarData = useMemo(
    () =>
      MONTH_LABELS.map((month, index) => ({
        month,
        marketKg: roundTo(dnCalendar[index], 2),
      })),
    [dnCalendar],
  )
  const dnCycleProfileData = useMemo(
    () => buildDnCycleWaveProfile(state, calendarScenario),
    [state, calendarScenario],
  )

  const sensitivityLines = useMemo(
    () => buildSensitivityLines(state, sensitivityPct, calculateCrop),
    [state, sensitivityPct],
  )

  const farmMonthlyData = useMemo(() => {
    const area = state.farmAreaM2
    const sdMonthlyShelf = sdResult.avg.marketShelfM2PerYear / 12
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
  }, [state.cropType, state.farmAreaM2, sdResult, dnCalendar])

  const peakFarmMonth = useMemo(() => {
    let bestMonth = MONTH_LABELS[0]
    let bestKg = 0
    farmMonthlyData.forEach((row) => {
      const total =
        (typeof row.КСД === 'number' ? row.КСД : 0) + (typeof row.НСД === 'number' ? row.НСД : 0)
      if (total > bestKg) {
        bestKg = total
        bestMonth = String(row.month)
      }
    })
    return { month: bestMonth, kg: bestKg }
  }, [farmMonthlyData])

  useEffect(() => {
    const nextUrl = `${window.location.pathname}?${toSearchParams(state).toString()}`
    window.history.replaceState(null, '', nextUrl)
  }, [state])

  const updateCommonField = (
    key: 'density' | 'tiers' | 'farmAreaM2' | 'uncertaintyPct',
    value: number,
  ) => {
    setState((prev) => {
      if (key === 'density') return { ...prev, density: clamp(value, 1, 90) }
      if (key === 'tiers') return { ...prev, tiers: clamp(value, 1, 30) }
      if (key === 'farmAreaM2') return { ...prev, farmAreaM2: clamp(value, 1) }
      return { ...prev, uncertaintyPct: clamp(value, 0, 30) }
    })
  }

  const updateQualityField = (key: QualityField, value: number) => {
    setState((prev) => {
      if (key === 'packout') return { ...prev, packout: normalizeFactor(value, 0.5, 1) }
      return { ...prev, [key]: normalizeFactor(value, 0.3, 1) }
    })
  }

  const updateTripleField = (field: TripleField, scenario: Scenario, value: number) => {
    setState((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [scenario]: value,
      },
    }))
  }

  const toggleDnManualProfile = (enabled: boolean) => {
    setState((prev) => ({ ...prev, dnManualProfileEnabled: enabled }))
  }

  const updateDnManualMonth = (monthIndex: number, value: number) => {
    setState((prev) => {
      const next = [...prev.dnManualMonthlyPlantYield]
      next[monthIndex] = clamp(value, 0, 5)
      return { ...prev, dnManualMonthlyPlantYield: next }
    })
  }

  const hasSdWarning = !isOrdered(state.sdYieldPerPlant)
  const hasDnWarning = !isOrdered(state.dnYieldPerPlant)

  const activeCrops: Array<'SD' | 'DN'> = state.cropType === 'both' ? ['SD', 'DN'] : [state.cropType]

  const chartData = SCENARIOS.map((scenario) => ({
    scenario: SCENARIO_LABELS[scenario],
    КСД: roundTo(sdResult[scenario].marketShelfM2PerYear, 1),
    НСД: roundTo(dnResult[scenario].marketShelfM2PerYear, 1),
  }))

  const percentileChartData = [
    { p: 'Нижняя 10%', КСД: roundTo(uncertaintySD.p10, 1), НСД: roundTo(uncertaintyDN.p10, 1) },
    { p: 'Средняя 50%', КСД: roundTo(uncertaintySD.p50, 1), НСД: roundTo(uncertaintyDN.p50, 1) },
    { p: 'Верхняя 90%', КСД: roundTo(uncertaintySD.p90, 1), НСД: roundTo(uncertaintyDN.p90, 1) },
  ]

  const exportCsv = () => {
    const rows: string[] = []
    rows.push(
      [
        'Тип',
        'Сценарий',
        'Циклов/год',
        'Валовый кг/м2 поверхности/год',
        'Биологический кг/м2 поверхности/год',
        'Товарный кг/м2 поверхности/год',
        'Товарный кг/м2 пола/год',
        'Ферма товарный кг/год',
        'Ферма товарный кг/мес',
        'НСД: продуктивные месяцы',
        'НСД: товарный кг/м2 в продуктивный месяц',
      ].join(';'),
    )
    activeCrops.forEach((crop) => {
      const result = crop === 'SD' ? sdResult : dnResult
      SCENARIOS.forEach((scenario) => {
        rows.push(
          [
            crop,
            SCENARIO_LABELS[scenario],
            formatValue(result[scenario].cyclesPerYear, 2),
            formatValue(result[scenario].grossShelfM2PerYear, 2),
            formatValue(result[scenario].bioShelfM2PerYear, 2),
            formatValue(result[scenario].marketShelfM2PerYear, 2),
            formatValue(result[scenario].marketFloorM2PerYear, 2),
            formatValue(result[scenario].farmMarketAnnualKg, 2),
            formatValue(result[scenario].farmMarketMonthlyKg, 2),
            formatValue(result[scenario].productiveMonths, 2),
            formatValue(result[scenario].productiveMonthMarketKg, 2),
          ].join(';'),
        )
      })
    })

    rows.push('')
    rows.push(`Коэффициент потерь;${state.kLosses}`)
    rows.push(`Коэффициент рисков;${state.kPests}`)
    rows.push(`Доля товарной ягоды;${state.packout}`)
    rows.push(`Неопределенность,%;${state.uncertaintyPct}`)

    const csv = `\uFEFF${rows.join('\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'strawberry-calculator-v3.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setLinkStatus('')
      showToast('Ссылка скопирована в буфер обмена.')
    } catch {
      showToast('Не удалось скопировать ссылку.')
    }
  }

  const cropTypeLabel =
    state.cropType === 'both' ? 'КСД + НСД' : state.cropType === 'SD' ? 'КСД' : 'НСД'

  const runPdfExport = async (sectionIds: string[]) => {
    setPdfExporting(true)
    try {
      const date = new Date().toLocaleDateString('ru-RU')
      await exportSectionsToPdf(sectionIds, {
        title: 'Калькулятор урожая клубники · Daogreen',
        subtitle: 'Daogreen — проектирование и запуск вертикальных ферм',
        date,
        lines: [
          { label: 'Культура', value: cropTypeLabel },
          {
            label: 'База расчёта',
            value: AREA_BASIS_SHORT[state.areaBasis],
          },
          { label: 'Плотность', value: `${state.density} раст/м²` },
          { label: 'Ярусов', value: String(state.tiers) },
          { label: 'Площадь фермы', value: `${state.farmAreaM2} м²` },
          {
            label: 'КСД (средний)',
            value: `${formatValue(sdResult.avg.marketMainM2PerYear, 1)} кг/м²/год`,
          },
          {
            label: 'НСД (средний)',
            value: `${formatValue(dnResult.avg.marketMainM2PerYear, 1)} кг/м²/год`,
          },
        ],
      })
      setPdfDialogOpen(false)
      showToast('PDF сохранён на устройство.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось сформировать PDF.'
      showToast(message)
    } finally {
      setPdfExporting(false)
    }
  }

  const closeWizard = () => {
    localStorage.setItem('berryWizardDone', '1')
    setWizardOpen(false)
    showToast('Настройка завершена. Результаты справа.')
  }

  const normalizeHeader = (raw: string): string => raw.toLowerCase().replace(/\s+/g, '').replace(/_/g, '')

  const runCalibrationFromCsv = (text: string): { message: string; nextState: CalculatorState | null } => {
    const rows = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    if (rows.length < 2) {
      return { message: 'Файл данных пустой или содержит только строку заголовка.', nextState: null }
    }

    const delimiter = rows[0].includes(';') ? ';' : ','
    const headers = rows[0].split(delimiter).map(normalizeHeader)
    const cropIndex = headers.findIndex((h) =>
      ['тип', 'культура', 'crop', 'type', 'sort', 'culture'].includes(h),
    )
    const scenarioIndex = headers.findIndex((h) =>
      ['сценарий', 'scenario', 'scen', 'mode'].includes(h),
    )
    const observedIndex = headers.findIndex((h) =>
      [
        'факткгм2поверхностигод',
        'факткгм2полкигод',
        'observedkgshelfyear',
        'actualkgshelfyear',
        'kgshelfyear',
        'observed',
        'actual',
        'yield',
      ].includes(h),
    )

    if (cropIndex < 0 || observedIndex < 0) {
      return {
        message:
          'Не найдены колонки "тип" и "факт_кг_м2_поверхности_год". Пример заголовка: тип;сценарий;факт_кг_м2_поверхности_год',
        nextState: null,
      }
    }

    const ratios: number[] = []
    for (let i = 1; i < rows.length; i += 1) {
      const cells = rows[i].split(delimiter).map((cell) => cell.trim())
      const cropRaw = (cells[cropIndex] ?? '').toUpperCase()
      const scenarioRaw = (cells[scenarioIndex] ?? 'avg').toLowerCase()
      const observed = Number(cells[observedIndex] ?? '')
      if (Number.isNaN(observed) || observed <= 0) continue

      const crop: 'SD' | 'DN' | null =
        cropRaw === 'SD' || cropRaw === 'KSD' || cropRaw === 'КСД'
          ? 'SD'
          : cropRaw === 'DN' || cropRaw === 'NSD' || cropRaw === 'НСД'
            ? 'DN'
            : null
      if (!crop) continue

      const scenario: Scenario =
        scenarioRaw === 'min' || scenarioRaw === 'avg' || scenarioRaw === 'max'
          ? scenarioRaw
          : scenarioRaw === 'мин'
            ? 'min'
            : scenarioRaw === 'макс'
              ? 'max'
              : 'avg'

      const raw = computeScenarioRaw(state, crop, scenario).grossShelfM2PerYear
      if (raw > 0) ratios.push(observed / raw)
    }

    if (ratios.length === 0) {
      return { message: 'В файле данных не найдено корректных строк для калибровки.', nextState: null }
    }

    const targetMarketRatio = ratios.reduce((sum, value) => sum + value, 0) / ratios.length
    const targetCore = clamp(targetMarketRatio / state.packout, 0.3, 1.2)
    const currentCore = getCoreFactor(state)
    const scale = Math.sqrt(targetCore / currentCore)

    const nextState: CalculatorState = {
      ...state,
      kLosses: clamp(state.kLosses * scale, 0.3, 1),
      kPests: clamp(state.kPests * scale, 0.3, 1),
    }

    const message = `Калибровка выполнена: обработано строк ${ratios.length}, целевой товарный коэффициент ${roundTo(targetMarketRatio, 3)}.`
    return { message, nextState }
  }

  const onCalibrationFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const calibration = runCalibrationFromCsv(text)
    setCalibrationStatus(calibration.message)
    if (calibration.nextState) setState(calibration.nextState)
    event.target.value = ''
  }

  return (
    <main className={`app ${clientMode ? 'client-mode' : ''}`}>
      <Toast message={toast} />
      <StickySummary
        cropType={state.cropType}
        areaBasis={state.areaBasis}
        sdAvg={sdResult.avg.marketMainM2PerYear}
        dnAvg={dnResult.avg.marketMainM2PerYear}
        visible={stickyVisible}
      />
      {showQr && <QrModal url={window.location.href} onClose={() => setShowQr(false)} />}
      <PdfExportDialog
        open={pdfDialogOpen}
        cropType={state.cropType}
        clientMode={clientMode}
        exporting={pdfExporting}
        onClose={() => setPdfDialogOpen(false)}
        onExport={runPdfExport}
      />
      {wizardOpen && (
        <SetupWizard
          step={wizardStep}
          cropType={state.cropType}
          areaBasis={state.areaBasis}
          density={state.density}
          tiers={state.tiers}
          farmAreaM2={state.farmAreaM2}
          onCropType={(cropType) => setState((prev) => ({ ...prev, cropType }))}
          onAreaBasis={(areaBasis) => setState((prev) => ({ ...prev, areaBasis }))}
          onDensity={(density) => updateCommonField('density', density)}
          onTiers={(tiers) => updateCommonField('tiers', tiers)}
          onFarmArea={(farmAreaM2) => updateCommonField('farmAreaM2', farmAreaM2)}
          kLosses={state.kLosses}
          kPests={state.kPests}
          packout={state.packout}
          onKLosses={(value) => updateQualityField('kLosses', value)}
          onKPests={(value) => updateQualityField('kPests', value)}
          onPackout={(value) => updateQualityField('packout', value)}
          onStep={setWizardStep}
          onClose={closeWizard}
        />
      )}

      <header className="header no-print">
        <div className="header-main">
          <a
            className="brand-lockup"
            href="https://daogreen.ru"
            target="_blank"
            rel="noopener noreferrer"
            title="Daogreen — вертикальные фермы"
          >
            <img src={LOGO_SRC} alt="Daogreen" className="brand-logo" />
          </a>
          <div className="header-copy">
            <h1>Калькулятор урожайности клубники</h1>
            <p className="sub brand-line">
              <strong>Daogreen</strong> — проектирование и запуск вертикальных ферм. Расчёт валового, биологического
              и товарного урожая КСД и НСД с настройкой сценариев, волн и рисков.
            </p>
          </div>
        </div>

        <div className="header-tools">
          <label className="client-toggle">
            <input
              type="checkbox"
              checked={clientMode}
              onChange={(event) => setClientMode(event.target.checked)}
            />
            Режим для клиента
          </label>
          <button type="button" className="ghost-btn" onClick={() => setWizardOpen(true)}>
            Мастер
          </button>
          {canUndo && (
            <button type="button" className="ghost-btn" onClick={undo} title="Ctrl+Z">
              Отменить
            </button>
          )}
        </div>

        <div className="switchers">
          <div className="toggle">
            {(['SD', 'DN', 'both'] as CropType[]).map((type) => (
              <button
                key={type}
                type="button"
                className={state.cropType === type ? 'active' : ''}
                onClick={() => setState((prev) => ({ ...prev, cropType: type }))}
              >
                {type === 'both' ? 'Сравнить оба' : type === 'SD' ? 'КСД' : 'НСД'}
              </button>
            ))}
          </div>
          <div className="toggle">
            {(['shelf', 'floor'] as AreaBasis[]).map((basis) => (
              <button
                key={basis}
                type="button"
                className={state.areaBasis === basis ? 'active' : ''}
                onClick={() => setState((prev) => ({ ...prev, areaBasis: basis }))}
              >
                {AREA_BASIS_BUTTON_LABELS[basis]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mobile-crop-tabs">
        {(['SD', 'DN', 'both'] as CropType[]).map((type) => (
          <button
            key={type}
            type="button"
            className={state.cropType === type ? 'active' : ''}
            onClick={() => setState((prev) => ({ ...prev, cropType: type }))}
          >
            {type === 'both' ? 'Оба' : type === 'SD' ? 'КСД' : 'НСД'}
          </button>
        ))}
      </div>

      <section className="layout">
        <aside className="panel no-print-panel">
          <h2>Параметры</h2>

          {!clientMode && (
          <section className="crop-block guide-block">
            <h3>Инструкция Daogreen</h3>
            <p className="hint guide-intro">
              Краткое руководство по полям калькулятора. Значок <strong>?</strong> у строки дублирует подсказку.
            </p>
            <details open={!isMobileGuide}>
              <summary>1) Базовая логика расчёта</summary>
              <p className="hint">
                Валовый урожай строится из выхода с растения за цикл и числа циклов в год. Затем применяются
                коэффициенты потерь, рисков и доля товарной ягоды — получается товарный урожай.
              </p>
              <p className="hint">
                Формула: <code>товарный = валовый × коэффициент_потерь × коэффициент_рисков × доля_товарной_ягоды</code>
              </p>
              <p className="hint">
                Свет, опыление, питание и климат в модели считаются идеальными и не задаются отдельными коэффициентами.
              </p>
              <p className="hint">
                <strong>База расчёта:</strong> «полезная посевная площадь» — урожай на площадь посадки ярусов;
                «площадь по полу» — пересчёт через число ярусов на площадь пола фермы.
              </p>
            </details>
            <details>
              <summary>2) Режимы и управление</summary>
              <ul className="guide-list">
                <li>
                  <strong>Режим для клиента:</strong> упрощённый вид — только средний сценарий и основные графики.
                </li>
                <li>
                  <strong>Мастер:</strong> пошаговая первичная настройка культуры, площади и коэффициентов качества.
                </li>
                <li>
                  <strong>Отменить (Ctrl+Z):</strong> возврат к предыдущему состоянию параметров.
                </li>
                <li>
                  <strong>Скопировать ссылку / QR-код:</strong> сохранить и передать текущий расчёт (все значения в URL).
                </li>
                <li>
                  <strong>Выгрузка PDF:</strong> выбор разделов и скачивание файла без печати.
                </li>
                <li>
                  <strong>Чувствительность:</strong> таблица «что если» при ±% к плотности и урожаю с куста.
                </li>
                <li>
                  <strong>Помесячный сбор с фермы:</strong> сколько кг товарной ягоды снимается с площадки по месяцам.
                </li>
                <li>
                  <strong>Экспорт данных:</strong> таблица результатов в CSV.
                </li>
              </ul>
            </details>
            <details>
              <summary>3) Общие поля</summary>
              <ul className="guide-list">
                <li>
                  <strong>Плотность, раст/м² поверхности:</strong> линейно масштабирует урожай на м².
                </li>
                <li>
                  <strong>Число ярусов:</strong> влияет на пересчёт «площадь по полу» и на базу «полезная посевная площадь».
                </li>
                <li>
                  <strong>Посевная полезная площадь фермы, м²:</strong> масштабирует итог на всю площадку (кг/год, кг/мес).
                </li>
                <li>
                  <strong>Неопределённость %:</strong> ширина диапазона P10/P50/P90; средний сценарий при этом не меняется.
                </li>
              </ul>
            </details>
            <details>
              <summary>4) Качество и товарность</summary>
              <ul className="guide-list">
                <li>
                  <strong>Коэффициент технологических потерь:</strong> брак, пересорт, технологические потери.
                </li>
                <li>
                  <strong>Коэффициент рисков:</strong> болезни, вредители, стресс растений.
                </li>
                <li>
                  <strong>Доля товарной ягоды:</strong> какая часть биологического урожая идёт в продажу.
                </li>
              </ul>
              <p className="hint">Все три коэффициента задаются вручную — вводите свои значения под конкретный проект.</p>
            </details>
            <details>
              <summary>5) КСД и НСД: сценарии Минимум / Средний / Максимум</summary>
              <ul className="guide-list">
                <li>
                  <strong>Выход с куста за цикл:</strong> основа урожая сценария, кг с растения.
                </li>
                <li>
                  <strong>Длина цикла:</strong> через неё считается число циклов в год.
                </li>
                <li>
                  <strong>Оборот НСД:</strong> пауза между циклами; увеличивает длительность цикла и снижает циклы в год.
                </li>
                <li>
                  <strong>Расширенные параметры НСД:</strong> волны плодоношения, установление, доли волн — для календаря и
                  профиля внутри цикла (справочно, на итог в ручном режиме не влияют).
                </li>
              </ul>
            </details>
            <details>
              <summary>6) Ручной помесячный профиль НСД</summary>
              <ul className="guide-list">
                <li>
                  <strong>Янв…Дек:</strong> кг с одного растения за конкретный месяц года.
                </li>
                <li>
                  <strong>0 в месяце:</strong> месяц без сбора.
                </li>
                <li>
                  <strong>Сумма 12 месяцев:</strong> годовой урожай с растения в среднем сценарии.
                </li>
                <li>
                  <strong>Минимум / Максимум:</strong> профиль масштабируется относительно «Среднего» сценария.
                </li>
              </ul>
            </details>
            <details>
              <summary>7) Результаты, графики и ориентиры</summary>
              <ul className="guide-list">
                <li>
                  <strong>Карточки сценариев:</strong> товарный урожай на выбранной базе площади; цветовая шкала — сравнение
                  с отраслевыми ориентирами (iFarm, Artechno и др.).
                </li>
                <li>
                  <strong>Сравнение КСД и НСД:</strong> товарный урожай, кг/м² поверхности в год.
                </li>
                <li>
                  <strong>Диапазон 10/50/90%:</strong> разброс при заданной неопределённости модели.
                </li>
                <li>
                  <strong>Календарь НСД:</strong> распределение урожая по месяцам года.
                </li>
                <li>
                  <strong>Профиль волны:</strong> форма сбора внутри цикла или ваш ручной помесячный профиль.
                </li>
              </ul>
            </details>
            <details>
              <summary>8) Выгрузка PDF</summary>
              <p className="hint">
                Кнопка «Выгрузка PDF» открывает список разделов: титул, результаты, графики, источники. Можно выбрать
                пресет «Краткий», «Для клиента» или «Полный». Файл сохраняется на устройство, диалог печати не используется.
              </p>
            </details>
            <details>
              <summary>9) Калибровка по фактическим данным</summary>
              <p className="hint">
                Формат CSV: <code>тип;сценарий;факт_кг_м2_поверхности_год</code> (пример:{' '}
                <code>НСД;средний;38.5</code>). Калибровка подстраивает коэффициенты под ваши фактические урожаи.
              </p>
            </details>
            <p className="hint guide-footer">Daogreen · daogreen.ru · модель даёт ориентиры, не заменяет пилотный прогон.</p>
          </section>
          )}

          <div className="inputs-row">
            <label className="field">
              <HintLabel label="Плотность, раст/м² поверхности" hint={FIELD_HINTS.density} />
              <input
                type="number"
                min={1}
                max={90}
                step={1}
                value={state.density}
                onChange={(event) => updateCommonField('density', Number(event.target.value))}
              />
            </label>
            <label className="field">
              <HintLabel label="Число ярусов" hint={FIELD_HINTS.tiers} />
              <input
                type="number"
                min={1}
                max={30}
                step={1}
                value={state.tiers}
                onChange={(event) => updateCommonField('tiers', Number(event.target.value))}
              />
            </label>
          </div>

          <div className="inputs-row">
            <label className="field">
              <HintLabel label="Посевная полезная площадь фермы, м²" hint={FIELD_HINTS.farmAreaM2} />
              <input
                type="number"
                min={1}
                step={0.1}
                value={state.farmAreaM2}
                onChange={(event) => updateCommonField('farmAreaM2', Number(event.target.value))}
              />
            </label>
            {!clientMode && (
            <label className="field">
              <HintLabel label={`Неопределённость модели, %: ${state.uncertaintyPct.toFixed(0)}`} hint={FIELD_HINTS.uncertaintyPct} />
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={state.uncertaintyPct}
                onChange={(event) => updateCommonField('uncertaintyPct', Number(event.target.value))}
              />
            </label>
            )}
          </div>

          <section className="crop-block">
            <h3>Качество и товарность</h3>
            <div className="inputs-row">
              <label className="field">
                <HintLabel label="Коэффициент технологических потерь" hint={FIELD_HINTS.kLosses} />
                <input
                  type="number"
                  min={0.3}
                  max={1}
                  step={0.01}
                  value={state.kLosses}
                  onChange={(event) => updateQualityField('kLosses', Number(event.target.value))}
                />
              </label>
              <label className="field">
                <HintLabel label="Коэффициент рисков (болезни/вредители)" hint={FIELD_HINTS.kPests} />
                <input
                  type="number"
                  min={0.3}
                  max={1}
                  step={0.01}
                  value={state.kPests}
                  onChange={(event) => updateQualityField('kPests', Number(event.target.value))}
                />
              </label>
            </div>
            <label className="field">
              <HintLabel label="Доля товарной ягоды" hint={FIELD_HINTS.packout} />
              <input
                type="number"
                min={0.5}
                max={1}
                step={0.01}
                value={state.packout}
                onChange={(event) => updateQualityField('packout', Number(event.target.value))}
              />
            </label>
            <p className="hint">
              Итог: коэффициент качества = {formatValue(coreFactor, 3)}, коэффициент товарного выхода ={' '}
              {formatValue(totalMarketFactor, 3)}
            </p>
          </section>

          {(state.cropType === 'SD' || state.cropType === 'both') && (
            <section className="crop-block">
              <h3>КСД</h3>
              <TripleInputs
                title="Выход с куста за цикл"
                unit="кг"
                hint={FIELD_HINTS.sdYield}
                clientMode={clientMode}
                values={state.sdYieldPerPlant}
                min={0.1}
                step={0.01}
                onChange={(scenario, value) => updateTripleField('sdYieldPerPlant', scenario, value)}
              />
              <TripleInputs
                title="Длина цикла КСД"
                unit="мес"
                hint={FIELD_HINTS.sdCycle}
                clientMode={clientMode}
                values={state.sdCycleMonths}
                min={1}
                step={0.1}
                onChange={(scenario, value) => updateTripleField('sdCycleMonths', scenario, value)}
              />
              {hasSdWarning && <p className="warning">Рекомендуемый порядок: Минимум ≤ Средний ≤ Максимум.</p>}
            </section>
          )}

          {(state.cropType === 'DN' || state.cropType === 'both') && (
            <section className="crop-block">
              <h3>НСД</h3>
              <TripleInputs
                title="Выход с куста за цикл"
                unit="кг"
                hint={FIELD_HINTS.dnYield}
                clientMode={clientMode}
                values={state.dnYieldPerPlant}
                min={0.1}
                step={0.01}
                onChange={(scenario, value) => updateTripleField('dnYieldPerPlant', scenario, value)}
              />
              <TripleInputs
                title="Длина цикла НСД (отдельно для Мин/Средний/Макс)"
                unit="мес"
                hint={FIELD_HINTS.dnCycle}
                clientMode={clientMode}
                values={state.dnCycleMonths}
                min={1}
                step={0.1}
                onChange={(scenario, value) => updateTripleField('dnCycleMonths', scenario, value)}
              />
              {!clientMode && (
              <TripleInputs
                title="Оборот между циклами НСД"
                unit="мес"
                hint={FIELD_HINTS.dnTurnaround}
                values={state.dnTurnaroundMonths}
                min={0}
                step={0.1}
                onChange={(scenario, value) => updateTripleField('dnTurnaroundMonths', scenario, value)}
              />
              )}
              {!clientMode && (
              <>
              <label className="field checkbox-field">
                <span>
                  <input
                    type="checkbox"
                    checked={state.dnManualProfileEnabled}
                    onChange={(event) => toggleDnManualProfile(event.target.checked)}
                  />{' '}
                  Ручной помесячный профиль урожая НСД (кг с растения в месяц)
                </span>
              </label>
              {state.dnManualProfileEnabled && (
                <div className="manual-month-grid">
                  {MONTH_LABELS.map((month, index) => (
                    <label key={month} className="field manual-month-cell">
                      <span>{month}</span>
                      <input
                        type="number"
                        min={0}
                        max={5}
                        step={0.01}
                        value={state.dnManualMonthlyPlantYield[index]}
                        onChange={(event) => updateDnManualMonth(index, Number(event.target.value))}
                      />
                    </label>
                  ))}
                </div>
              )}
              {state.dnManualProfileEnabled && (
                <p className="hint">
                  В ручном режиме НСД расчёт берёт ваш помесячный урожай напрямую, затем масштабирует по
                  сценариям (Мин/Средний/Макс) через коэффициент сценария.
                </p>
              )}
              {state.dnManualProfileEnabled && (
                <p className="hint">
                  Сумма ручного профиля сейчас: {formatValue(dnManualAnnualPlant, 2)} кг/раст/год (база для Avg).
                </p>
              )}
              </>
              )}
              {!clientMode && hasDnWarning && <p className="warning">Рекомендуемый порядок: Минимум ≤ Средний ≤ Максимум.</p>}

              {!clientMode && (
              <details>
                <summary>Расширенные параметры НСД и волн</summary>
                <TripleInputs
                  title="Количество волн плодоношения (справочно)"
                  unit="шт"
                  values={state.dnWaves}
                  min={1}
                  step={0.1}
                  onChange={(scenario, value) => updateTripleField('dnWaves', scenario, value)}
                />
                <TripleInputs
                  title="Установление до первого сбора"
                  unit="мес"
                  values={state.dnEstablishMonths}
                  min={0.1}
                  step={0.1}
                  onChange={(scenario, value) => updateTripleField('dnEstablishMonths', scenario, value)}
                />
                <TripleInputs
                  title="Доля 1-й волны (0..1)"
                  unit="доля"
                  values={state.dnWave1Share}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(scenario, value) => updateTripleField('dnWave1Share', scenario, value)}
                />
                <TripleInputs
                  title="Доля 2-й волны (0..1)"
                  unit="доля"
                  values={state.dnWave2Share}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(scenario, value) => updateTripleField('dnWave2Share', scenario, value)}
                />
                <TripleInputs
                  title="Средняя масса ягоды (справочно)"
                  unit="г"
                  values={state.berryMassG}
                  min={1}
                  step={0.1}
                  onChange={(scenario, value) => updateTripleField('berryMassG', scenario, value)}
                />
              </details>
              )}
            </section>
          )}

          {!clientMode && (
          <section className="crop-block">
            <h3>Калибровка по фактическим данным (файл)</h3>
            <p className="hint">
              Формат: `тип;сценарий;факт_кг_м2_поверхности_год` (пример: `НСД;средний;38.5`).
            </p>
            <label className="field">
              <span>Загрузить файл данных</span>
              <input type="file" accept=".csv,text/csv" onChange={onCalibrationFile} />
            </label>
            <p className="status">{calibrationStatus}</p>
          </section>
          )}

          <div className="actions panel-actions">
            <button type="button" onClick={() => setState(DEFAULT_STATE)}>
              Сбросить
            </button>
            <button type="button" onClick={exportCsv}>
              Экспорт данных
            </button>
            <button type="button" onClick={copyLink}>
              Скопировать ссылку
            </button>
            <button type="button" onClick={() => setShowQr(true)}>
              QR-код
            </button>
            <button type="button" onClick={() => setPdfDialogOpen(true)}>
              Выгрузка PDF
            </button>
          </div>
          {linkStatus && <p className="status">{linkStatus}</p>}
        </aside>

        <section className="results print-area">
          <div className="print-only print-header">
            <h2>Калькулятор урожая клубники — отчёт · Daogreen</h2>
            <p>
              Плотность {state.density} раст/м² · ярусов {state.tiers} · площадь {state.farmAreaM2} м² · база:{' '}
              {AREA_BASIS_SHORT[state.areaBasis]}
            </p>
          </div>
          {(state.cropType === 'SD' || state.cropType === 'both') && (
            <div id="pdf-sec-results-sd">
              <ResultsTable crop="SD" title="Результаты КСД" result={sdResult} areaBasis={state.areaBasis} clientMode={clientMode} />
            </div>
          )}
          {(state.cropType === 'DN' || state.cropType === 'both') && (
            <div id="pdf-sec-results-dn">
              <ResultsTable crop="DN" title="Результаты НСД" result={dnResult} areaBasis={state.areaBasis} clientMode={clientMode} />
            </div>
          )}

          <section className="chart-card" id="pdf-sec-chart-compare">
            <h3>Сравнение КСД и НСД (товарный урожай, кг/м² поверхности в год)</h3>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={290}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="scenario" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine y={40} stroke="#6b7280" strokeDasharray="4 4" label="Artechno 40" />
                  <ReferenceLine y={41} stroke="#16a34a" strokeDasharray="4 4" label="iFarm 41" />
                  <ReferenceLine y={45} stroke="#166534" strokeDasharray="4 4" label="iFarm 45" />
                  <Bar dataKey="КСД" fill="#ec4899" />
                  <Bar dataKey="НСД" fill="#4f46e5" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="chart-card" id="pdf-sec-chart-sensitivity">
            <h3>Чувствительность к плотности и урожаю (средний сценарий)</h3>
            <label className="field">
              <span>Диапазон отклонения: ±{sensitivityPct}%</span>
              <input
                type="range"
                min={5}
                max={20}
                step={1}
                value={sensitivityPct}
                onChange={(event) => setSensitivityPct(Number(event.target.value))}
              />
            </label>
            <div className="table-wrap">
              <table className="sensitivity-table">
                <thead>
                  <tr>
                    <th>Вариант</th>
                    {(state.cropType === 'SD' || state.cropType === 'both') && (
                      <>
                        <th>КСД, кг/м²/год</th>
                        <th>КСД, кг/год фермы</th>
                      </>
                    )}
                    {(state.cropType === 'DN' || state.cropType === 'both') && (
                      <>
                        <th>НСД, кг/м²/год</th>
                        <th>НСД, кг/год фермы</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sensitivityLines.map((line) => (
                    <tr key={line.id} className={line.id === 'base' ? 'sensitivity-base' : ''}>
                      <td>{line.label}</td>
                      {(state.cropType === 'SD' || state.cropType === 'both') && (
                        <>
                          <td>{formatValue(line.sd, 1)}</td>
                          <td>{formatValue(line.sdFarmKg, 0)}</td>
                        </>
                      )}
                      {(state.cropType === 'DN' || state.cropType === 'both') && (
                        <>
                          <td>{formatValue(line.dn, 1)}</td>
                          <td>{formatValue(line.dnFarmKg, 0)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint">
              Показывает, как меняется товарный урожай при отклонении плотности и/или выхода с куста на выбранный
              процент. База: {AREA_BASIS_SHORT[state.areaBasis]}, площадь фермы {formatValue(state.farmAreaM2, 1)} м².
            </p>
          </section>

          <section className="chart-card" id="pdf-sec-chart-farm-monthly">
            <h3>Помесячный сбор с фермы, кг (товарный)</h3>
            {(state.cropType === 'DN' || state.cropType === 'both') && (
              <div className="toggle compact">
                {SCENARIOS.map((scenario) => (
                  <button
                    key={scenario}
                    type="button"
                    className={calendarScenario === scenario ? 'active' : ''}
                    onClick={() => setCalendarScenario(scenario)}
                  >
                    {SCENARIO_LABELS[scenario]}
                  </button>
                ))}
              </div>
            )}
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={farmMonthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => [`${formatValue(Number(value), 1)} кг`, '']}
                    labelFormatter={(label) => `Месяц: ${label}`}
                  />
                  <Legend />
                  {(state.cropType === 'SD' || state.cropType === 'both') && (
                    <Bar dataKey="КСД" fill="#ec4899" name="КСД, кг с фермы" />
                  )}
                  {(state.cropType === 'DN' || state.cropType === 'both') && (
                    <Bar dataKey="НСД" fill="#4f46e5" name="НСД, кг с фермы" />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="hint">
              КСД: равномерный сбор по месяцам. НСД: по календарю волн. Пик суммарного сбора:{' '}
              <strong>
                {peakFarmMonth.month} — {formatValue(peakFarmMonth.kg, 0)} кг
              </strong>{' '}
              при площади {formatValue(state.farmAreaM2, 1)} м².
            </p>
          </section>

          {!clientMode && (
          <section className="chart-card" id="pdf-sec-chart-uncertainty">
            <h3>Диапазон неопределенности 10/50/90% (товарный кг/м² {AREA_BASIS_GENITIVE[state.areaBasis]} в год)</h3>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={percentileChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="p" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="КСД" fill="#f472b6" />
                  <Bar dataKey="НСД" fill="#818cf8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="hint">
              КСД: 10%={formatValue(uncertaintySD.p10, 1)}, 50%={formatValue(uncertaintySD.p50, 1)},
              90%={formatValue(uncertaintySD.p90, 1)}. НСД: 10%={formatValue(uncertaintyDN.p10, 1)},
              50%={formatValue(uncertaintyDN.p50, 1)}, 90%={formatValue(uncertaintyDN.p90, 1)}.
            </p>
          </section>
          )}

          {!clientMode && (state.cropType === 'DN' || state.cropType === 'both') && (
          <section className="chart-card" id="pdf-sec-chart-dn-calendar">
            <h3>Календарь НСД по волнам (товарный кг/м² поверхности в месяц)</h3>
            <div className="toggle compact">
              {SCENARIOS.map((scenario) => (
                <button
                  key={scenario}
                  type="button"
                  className={calendarScenario === scenario ? 'active' : ''}
                  onClick={() => setCalendarScenario(scenario)}
                >
                  {SCENARIO_LABELS[scenario]}
                </button>
              ))}
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dnCalendarData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="marketKg" fill="#0ea5e9" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="hint">
              {state.dnManualProfileEnabled
                ? 'Это календарь из твоего ручного помесячного профиля.'
                : 'Это распределение урожая по месяцам года с учётом фаз цикла и волн.'}
            </p>
          </section>
          )}

          {!clientMode && (state.cropType === 'DN' || state.cropType === 'both') && (
          <section className="chart-card" id="pdf-sec-chart-dn-profile">
            <h3>
              {state.dnManualProfileEnabled
                ? 'Ручной профиль НСД по месяцам (товарный кг/м² поверхности в месяц)'
                : 'Экспонента волны внутри цикла НСД (рост → пик → спад)'}
            </h3>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={dnCycleProfileData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    label={{
                      value: state.dnManualProfileEnabled ? 'Месяц года' : 'Месяц цикла',
                      position: 'insideBottom',
                      offset: -4,
                    }}
                  />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="marketKgPerMonth"
                    stroke="#fb7185"
                    strokeWidth={2}
                    dot={false}
                    name="кг/м²/мес"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="hint">
              {state.dnManualProfileEnabled
                ? 'Линия строится из 12 заданных вами помесячных значений на растение.'
                : 'График показывает неравномерный сбор в пределах цикла: установление, пик 1-й/2-й/3-й волны и спад.'}
            </p>
          </section>
          )}

          <section className="sources-card" id="pdf-sec-sources">
            <h3>Источники и доверие</h3>
            <ul>
              <li>iFarm Berries: структура КСД/НСД, потолочные и подтверждённые урожаи.</li>
              <li>Ferme d'Hiver: 160 кг/м² пола/год, Plenty: ~480 кг/м² пола/год.</li>
              <li>Artechno AVF+: целевой диапазон 40-60 кг/м²/год.</li>
              <li>Agrotonomy и Lyine: технологические ориентиры для параметризации модели.</li>
            </ul>
            <p className="global-note">
              Важно: модель даёт ориентиры и диапазон неопределённости, но не заменяет пилотный прогон под ваш
              сорт, свет и конкретную схему опыления.
            </p>
          </section>
        </section>
      </section>

      <div className="mobile-actions no-print">
        <button type="button" onClick={() => setState(DEFAULT_STATE)}>
          Сбросить
        </button>
        <button type="button" onClick={exportCsv}>
          Экспорт
        </button>
        <button type="button" onClick={copyLink}>
          Ссылка
        </button>
        <button type="button" onClick={() => setShowQr(true)}>
          QR
        </button>
        <button type="button" onClick={() => setPdfDialogOpen(true)}>
          PDF
        </button>
      </div>
    </main>
  )
}

export default App
