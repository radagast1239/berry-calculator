import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'
import { CHART } from './chartColors'
import { CalculationSummary } from './CalculationSummary'
import { ChartExplainBlock } from './ChartExplainBlock'
import { ModelCaveatsBlock } from './ModelCaveatsBlock'
import { CROP_RESULT_CAVEATS, MODEL_DISCLAIMER, MODEL_LIMITATIONS_BULLETS } from './modelCaveats'
import { buildDenseAxis, buildMonthAxisTicks, compareDualAxes, maxOf } from './chartAxis'
import {
  buildCropLegendItems,
  CHART_MARGIN,
  ChartLegendRow,
  KgBarTopLabel,
  KgTooltip,
  SqmMonthTooltip,
  YieldBarTopLabel,
  YieldSqmTooltip,
} from './chartComponents'
import { AGRONOMIST_PURONEN_DENSITY, AGRONOMIST_PURONEN_PRESET, AGRONOMIST_PURONEN_SORT_NOTE } from './agronomistPresets'
import { fmtFarmMoYear, fmtSqmMoYear, yearlyToMonthly, YIELD_COL } from './yieldFormat'
import type { CropType, Scenario, Triple } from './types'
import type { CalculatorState, CropResult } from './calculatorTypes'
import { migrateCalculatorState, MODEL_VERSION, parseModelVersion } from './modelVersion'
import { buildSensitivityLines } from './sensitivity'
import { BerryEconPanel } from './BerryEconPanel'
import { DEFAULT_BERRY_ECON, migrateBerryEconState, type BerryEconState } from './berryEcon'
import { YIELD_BENCHMARKS } from './benchmarks'
import {
  buildDnCycleWaveProfile,
  buildDnMonthlyCalendar,
  buildSdCycleWaveProfile,
  buildSdMonthlyCalendar,
  calculateCrop,
  clamp,
  computeScenarioRaw,
  getCoreFactor,
  isOrdered,
  roundTo,
  simulatePercentiles,
} from './calculatorEngine'
import type { DnSeedlingMaterial } from './cropProfileConstants'
import { DEFAULT_SD_WEEKLY_SHARES } from './cropProfileConstants'
import { PdfExportDialog } from './PdfExportDialog'
import { exportSectionsToPdf, waitForPdfPaint } from './pdfExport'
import { MobileSortsStrip } from './MobileSortsStrip'
import { buildSortEconRows, SortEconComparePanel } from './SortEconComparePanel'
import { SortComparePanel } from './SortComparePanel'
import { SortsBar } from './SortsBar'
import { computeSortInsights } from './sortInsights'
import { extractFarmSettings, extractSortParams, mergeToCalculatorState } from './sortTypes'
import type { SortsCollection } from './sortTypes'
import { MAX_SORTS } from './sortTypes'
import { encodeSortsToUrl, exportSortsJson, importSortsJson } from './sortUrlCodec'
import {
  addSort,
  duplicateSort,
  initAppSortsState,
  persistFromCalculator,
  removeSort,
  renameSort,
  replaceSortsCollection,
  updateSortNotes,
} from './sortsStorage'
import {
  BENCHMARK_LEVEL_LABELS,
  FIELD_HINTS,
  getBenchmarkLevel,
  HintLabel,
  QrModal,
  SetupWizard,
  StickySummary,
  Toast,
  useStickyVisible,
  type WizardStep,
} from './uiHelpers'

type TripleField =
  | 'sdYieldPerPlant'
  | 'sdCycleMonths'
  | 'packout'
  | 'dnYieldPerPlant'
  | 'dnCycleMonths'
  | 'dnTurnaroundMonths'
  | 'dnWaves'
  | 'dnEstablishMonths'
  | 'dnWave1Share'
  | 'dnWave2Share'
  | 'dnInflorescenceLoss'
  | 'berryMassG'

type QualityField = 'kLosses' | 'kPests'

const SCENARIOS: Scenario[] = ['min', 'avg', 'max']
const MONTH_LABELS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

const SCENARIO_LABELS: Record<Scenario, string> = {
  min: 'Мин',
  avg: 'Средний',
  max: 'Макс',
}

const DEFAULT_STATE: CalculatorState = {
  cropType: 'both',
  density: 20,
  farmAreaM2: 1,
  kLosses: 1,
  kPests: 1,
  packout: { min: 1, avg: 1, max: 1 },
  uncertaintyPct: 8,
  sdYieldPerPlant: { min: 0.4, avg: 0.5, max: 0.6 },
  sdCycleMonths: { min: 3, avg: 3, max: 3 },
  sdFruitingWeeks: 6,
  sdWeeklyShares: [...DEFAULT_SD_WEEKLY_SHARES],
  dnYieldPerPlant: { min: 1, avg: 1.25, max: 1.5 },
  dnCycleMonths: { min: 6, avg: 6, max: 6 },
  dnTurnaroundMonths: { min: 0.2, avg: 0.2, max: 0.2 },
  dnWaves: { min: 2, avg: 2.5, max: 3 },
  dnEstablishMonths: { min: 2, avg: 1.75, max: 1.5 },
  dnWave1Share: { min: 0.55, avg: 0.45, max: 0.4 },
  dnWave2Share: { min: 0.45, avg: 0.35, max: 0.35 },
  dnSeedlingMaterial: 'manual',
  dnInflorescenceLoss: { min: 0.15, avg: 0.05, max: 0 },
  dnManualProfileEnabled: false,
  dnManualMonthlyPlantYield: [0, 0, 0.06, 0.14, 0.2, 0.14, 0.06, 0.06, 0.14, 0.2, 0.14, 0.06],
  berryMassG: { min: 8, avg: 11, max: 15 },
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

const parseWeeklyShares = (raw: string | null, fallback: number[]): number[] => {
  if (!raw) return [...fallback]
  const values = raw
    .split(',')
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .map((value) => clamp(value, 0, 1))
  if (values.length < 1) return [...fallback]
  return values
}

const toSearchParams = (state: CalculatorState, sortId?: string): URLSearchParams => {
  const params = new URLSearchParams()
  params.set('v', String(MODEL_VERSION))
  if (sortId) params.set('sortId', sortId)
  params.set('cropType', state.cropType)
  params.set('density', String(state.density))
  params.set('farmAreaM2', String(state.farmAreaM2))
  params.set('kLosses', String(state.kLosses))
  params.set('kPests', String(state.kPests))
  params.set('uncertaintyPct', String(state.uncertaintyPct))
  params.set('sdFruitingWeeks', String(state.sdFruitingWeeks))
  params.set('sdWeeklyShares', state.sdWeeklyShares.map((v) => roundTo(v, 3)).join(','))
  params.set('dnSeedlingMaterial', state.dnSeedlingMaterial)
  params.set('dnManualProfileEnabled', state.dnManualProfileEnabled ? '1' : '0')
  params.set(
    'dnManualMonthlyPlantYield',
    state.dnManualMonthlyPlantYield.map((value) => roundTo(value, 3)).join(','),
  )

  const triples: Array<[string, Triple]> = [
    ['packout', state.packout],
    ['sd_yieldPerPlant', state.sdYieldPerPlant],
    ['sd_cycleMonths', state.sdCycleMonths],
    ['dn_yieldPerPlant', state.dnYieldPerPlant],
    ['dn_cycleMonths', state.dnCycleMonths],
    ['dn_turnaroundMonths', state.dnTurnaroundMonths],
    ['dn_waves', state.dnWaves],
    ['dn_establishMonths', state.dnEstablishMonths],
    ['dn_wave1Share', state.dnWave1Share],
    ['dn_wave2Share', state.dnWave2Share],
    ['dn_inflorescenceLoss', state.dnInflorescenceLoss],
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

  const cropType: CropType =
    cropTypeRaw === 'SD' || cropTypeRaw === 'DN' || cropTypeRaw === 'both'
      ? cropTypeRaw
      : DEFAULT_STATE.cropType

  const legacyReality = parseNumber(params, 'realityFactor', 1, 0.3, 1)
  const legacyPerFactor = roundTo(Math.sqrt(legacyReality), 3)

  const legacyPackout = normalizeFactor(parseNumber(params, 'packout', DEFAULT_STATE.packout.avg, 0.4, 1), 0.4, 1)

  const parsed: CalculatorState = {
    cropType,
    density: parseNumber(params, 'density', DEFAULT_STATE.density, 1, 90),
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
    packout: params.has('packout_min') || params.has('packout_avg')
      ? parseTriple(params, 'packout', DEFAULT_STATE.packout, 0.4, 1)
      : { min: legacyPackout, avg: legacyPackout, max: legacyPackout },
    uncertaintyPct: parseNumber(params, 'uncertaintyPct', DEFAULT_STATE.uncertaintyPct, 0, 30),
    sdFruitingWeeks: parseNumber(params, 'sdFruitingWeeks', DEFAULT_STATE.sdFruitingWeeks, 1, 12),
    sdWeeklyShares: parseWeeklyShares(params.get('sdWeeklyShares'), DEFAULT_STATE.sdWeeklyShares),
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
    dnInflorescenceLoss: parseTriple(
      params,
      'dn_inflorescenceLoss',
      DEFAULT_STATE.dnInflorescenceLoss,
      0,
      0.95,
    ),
    dnSeedlingMaterial: (['manual', 'frigo', 'tray'].includes(params.get('dnSeedlingMaterial') ?? '')
      ? params.get('dnSeedlingMaterial')
      : DEFAULT_STATE.dnSeedlingMaterial) as DnSeedlingMaterial,
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
  const benchmark = YIELD_BENCHMARKS[crop]
  const level = getBenchmarkLevel(crop, value, YIELD_BENCHMARKS)
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
        {BENCHMARK_LEVEL_LABELS[level]} · ориентир: подтверждено{' '}
        {fmtSqmMoYear(yearlyToMonthly(benchmark.confirmed[0]), benchmark.confirmed[0], 1, 0)}–
        {fmtSqmMoYear(yearlyToMonthly(benchmark.confirmed[1]), benchmark.confirmed[1], 1, 0)} · потолок{' '}
        {fmtSqmMoYear(yearlyToMonthly(benchmark.ceiling[0]), benchmark.ceiling[0], 1, 0)}–
        {fmtSqmMoYear(yearlyToMonthly(benchmark.ceiling[1]), benchmark.ceiling[1], 1, 0)} кг/м²·мес · кг/м²/год
        (поверхность)
      </p>
    </div>
  )
}

function ScenarioCards({
  crop,
  result,
  clientMode = false,
}: {
  crop: 'SD' | 'DN'
  result: CropResult
  clientMode?: boolean
}) {
  const cards = clientMode ? (['avg'] as Scenario[]) : SCENARIOS
  return (
    <div className={`scenario-cards ${clientMode ? 'scenario-cards-client' : ''}`}>
      {cards.map((scenario) => {
        const level = getBenchmarkLevel(crop, result[scenario].marketShelfM2PerYear, YIELD_BENCHMARKS)
        return (
        <article className={`scenario-card scenario-${scenario} benchmark-card-${level}`} key={scenario}>
          <h4>{SCENARIO_LABELS[scenario]}</h4>
          <p className={`scenario-main benchmark-value-${level}`}>
            {fmtSqmMoYear(result[scenario].marketM2PerMonth, result[scenario].marketM2PerYear)}
            <span> кг/м²·мес · кг/м²/год (полезная посевная площадь)</span>
          </p>
          <p className="scenario-sub">
            Валовый: {fmtSqmMoYear(yearlyToMonthly(result[scenario].grossShelfM2PerYear), result[scenario].grossShelfM2PerYear)} кг/м²
            поверхности·мес · кг/м²/год
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
  clientMode = false,
}: {
  crop: 'SD' | 'DN'
  title: string
  result: CropResult
  clientMode?: boolean
}) {
  return (
    <section className="result-card">
      <h3>{title}</h3>
      <ScenarioCards crop={crop} result={result} clientMode={clientMode} />
      <div className={`table-wrap ${clientMode ? 'no-print-table' : ''}`}>
        <table>
          <thead>
            <tr>
              <th>Сценарий</th>
              <th>Циклов/год</th>
              <th>Валовый, кг/м² поверхности·мес · кг/м²/год</th>
              <th>Биологический, кг/м² поверхности·мес · кг/м²/год</th>
              <th>Товарный, кг/м² поверхности·мес · кг/м²/год</th>
              <th>Ферма, товарный {YIELD_COL.farm}</th>
            </tr>
          </thead>
          <tbody>
            {SCENARIOS.map((scenario) => (
              <tr key={scenario}>
                <td>{SCENARIO_LABELS[scenario]}</td>
                <td>{formatValue(result[scenario].cyclesPerYear, 2)}</td>
                <td>
                  {fmtSqmMoYear(
                    yearlyToMonthly(result[scenario].grossShelfM2PerYear),
                    result[scenario].grossShelfM2PerYear,
                  )}
                </td>
                <td>
                  {fmtSqmMoYear(
                    yearlyToMonthly(result[scenario].bioShelfM2PerYear),
                    result[scenario].bioShelfM2PerYear,
                  )}
                </td>
                <td>
                  {fmtSqmMoYear(
                    yearlyToMonthly(result[scenario].marketShelfM2PerYear),
                    result[scenario].marketShelfM2PerYear,
                  )}
                </td>
                <td>
                  {fmtFarmMoYear(result[scenario].farmMarketMonthlyKg, result[scenario].farmMarketAnnualKg, 1, 1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ModelCaveatsBlock items={CROP_RESULT_CAVEATS[crop]} compact />
    </section>
  )
}

const initialSortsRef = { current: null as ReturnType<typeof initAppSortsState> | null }

function App() {
  if (!initialSortsRef.current) {
    initialSortsRef.current = initAppSortsState(parseStateFromUrl())
  }
  const sortsCollectionRef = useRef<SortsCollection>(initialSortsRef.current.collection)

  const [state, setStateRaw] = useState<CalculatorState>(() => initialSortsRef.current!.state)
  const [sorts, setSorts] = useState(() => initialSortsRef.current!.collection.sorts)
  const [activeSortId, setActiveSortId] = useState(() => initialSortsRef.current!.collection.activeSortId)
  const [compareSortsOpen, setCompareSortsOpen] = useState(false)
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
  const [econOpen, setEconOpen] = useState(false)
  const [econ, setEcon] = useState<BerryEconState>(() => {
    try {
      const raw = localStorage.getItem('berryEconV1')
      return raw ? migrateBerryEconState(JSON.parse(raw)) : DEFAULT_BERRY_ECON
    } catch {
      return DEFAULT_BERRY_ECON
    }
  })
  const [sortsSavedAt, setSortsSavedAt] = useState<number | null>(null)
  const stickyVisible = useStickyVisible()

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
    document.title = 'Калькулятор урожайности клубники · Daogreen'
  }, [])

  useEffect(() => {
    localStorage.setItem('berryClientMode', clientMode ? '1' : '0')
  }, [clientMode])

  useEffect(() => {
    try {
      localStorage.setItem('berryEconV1', JSON.stringify(econ))
    } catch {
      // ignore
    }
  }, [econ])

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
  const totalMarketFactor = coreFactor * state.packout.avg
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
  const sdCycleProfileData = useMemo(
    () => buildSdCycleWaveProfile(state, calendarScenario),
    [state, calendarScenario],
  )
  const dnCycleProfileData = useMemo(
    () => buildDnCycleWaveProfile(state, calendarScenario),
    [state, calendarScenario],
  )

  const compareLegend = useMemo(
    () => buildCropLegendItems(state.cropType, 'yield', CHART),
    [state.cropType],
  )
  const farmLegend = useMemo(
    () => buildCropLegendItems(state.cropType, 'kg', CHART),
    [state.cropType],
  )
  const uncertaintyLegend = useMemo(
    () => buildCropLegendItems(state.cropType, 'soft', CHART),
    [state.cropType],
  )

  const sensitivityLines = useMemo(
    () => buildSensitivityLines(state, sensitivityPct, calculateCrop),
    [state, sensitivityPct],
  )

  const farmMonthlyData = useMemo(() => {
    const area = state.farmAreaM2
    const sdCalendar = buildSdMonthlyCalendar(state, calendarScenario)
    return MONTH_LABELS.map((month, index) => {
      const row: Record<string, string | number> = { month }
      if (state.cropType === 'SD' || state.cropType === 'both') {
        row.КСД = roundTo(sdCalendar[index] * area, 1)
      }
      if (state.cropType === 'DN' || state.cropType === 'both') {
        row.НСД = roundTo(dnCalendar[index] * area, 1)
      }
      return row
    })
  }, [state.cropType, state.farmAreaM2, state, calendarScenario, dnCalendar])

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

  const activeSort = useMemo(
    () => sorts.find((s) => s.id === activeSortId) ?? sorts[0],
    [sorts, activeSortId],
  )

  useEffect(() => {
    const collection = persistFromCalculator(
      sortsCollectionRef.current,
      state,
      activeSortId,
      activeSort?.notes,
    )
    sortsCollectionRef.current = collection
    setSortsSavedAt(Date.now())
    const params = toSearchParams(state, activeSortId)
    const encoded = encodeSortsToUrl(collection)
    if (encoded) params.set('sortsData', encoded)
    const nextUrl = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState(null, '', nextUrl)
  }, [state, activeSortId, sorts, activeSort?.notes])

  const sortCompareResults = useMemo(() => {
    const farm = extractFarmSettings(state)
    const sortsWithCurrent = sorts.map((s) =>
      s.id === activeSortId ? { ...s, params: extractSortParams(state) } : s,
    )
    return sortsWithCurrent.map((sort) => {
      const calcState = mergeToCalculatorState(farm, sort.params)
      return { sort, sd: calculateCrop(calcState, 'SD'), dn: calculateCrop(calcState, 'DN') }
    })
  }, [state, sorts, activeSortId])

  const farmSettings = useMemo(() => extractFarmSettings(state), [state])

  const sortEconRows = useMemo(() => {
    const sortsWithCurrent = sorts.map((s) =>
      s.id === activeSortId ? { ...s, params: extractSortParams(state) } : s,
    )
    return buildSortEconRows(sortsWithCurrent, farmSettings, state.cropType, econ)
  }, [sorts, state, activeSortId, farmSettings, state.cropType, econ])

  const sortInsights = useMemo(
    () =>
      computeSortInsights(
        sortCompareResults,
        state.cropType,
        sortEconRows.map((row) => ({ sortId: row.sort.id, econ: row.econ })),
      ),
    [sortCompareResults, sortEconRows, state.cropType],
  )

  const selectSort = useCallback(
    (id: string) => {
      if (id === activeSortId) return
      const saved = persistFromCalculator(sortsCollectionRef.current, state, activeSortId, activeSort?.notes)
      sortsCollectionRef.current = saved
      setSorts(saved.sorts)
      const target = saved.sorts.find((s) => s.id === id)
      if (!target) return
      sortsCollectionRef.current = { ...saved, activeSortId: id }
      setActiveSortId(id)
      setStateRaw(mergeToCalculatorState(extractFarmSettings(state), target.params))
      showToast(`Открыт сорт: ${target.name}`)
    },
    [activeSortId, state, showToast],
  )

  const handleAddSort = useCallback(() => {
    const saved = persistFromCalculator(sortsCollectionRef.current, state, activeSortId, activeSort?.notes)
    const next = addSort(saved)
    if (!next) {
      showToast('Можно сохранить не более 6 сортов.')
      return
    }
    sortsCollectionRef.current = next
    setSorts(next.sorts)
    const newSort = next.sorts[next.sorts.length - 1]
    setActiveSortId(newSort.id)
    setStateRaw(mergeToCalculatorState(extractFarmSettings(state), newSort.params))
    showToast(`Добавлен: ${newSort.name}`)
  }, [activeSortId, state, showToast])

  const handleRemoveSort = useCallback(
    (id: string) => {
      const saved = persistFromCalculator(sortsCollectionRef.current, state, activeSortId, activeSort?.notes)
      const next = removeSort(saved, id)
      if (!next) {
        showToast('Нужен хотя бы один сорт.')
        return
      }
      sortsCollectionRef.current = next
      setSorts(next.sorts)
      if (id === activeSortId) {
        const target = next.sorts.find((s) => s.id === next.activeSortId)
        if (target) {
          setActiveSortId(next.activeSortId)
          setStateRaw(mergeToCalculatorState(extractFarmSettings(state), target.params))
        }
      } else {
        setActiveSortId(next.activeSortId)
      }
      showToast('Сорт удалён.')
    },
    [activeSortId, state, showToast],
  )

  const handleRenameSort = useCallback((id: string, name: string) => {
    const next = renameSort(sortsCollectionRef.current, id, name)
    sortsCollectionRef.current = next
    setSorts(next.sorts)
  }, [])

  const handleDuplicateSort = useCallback(
    (id: string) => {
      const saved = persistFromCalculator(sortsCollectionRef.current, state, activeSortId, activeSort?.notes)
      const next = duplicateSort(saved, id)
      if (!next) {
        showToast('Можно сохранить не более 6 сортов.')
        return
      }
      sortsCollectionRef.current = next
      setSorts(next.sorts)
      const newSort = next.sorts[next.sorts.length - 1]
      setActiveSortId(newSort.id)
      setStateRaw(mergeToCalculatorState(extractFarmSettings(state), newSort.params))
      showToast(`Скопирован: ${newSort.name}`)
    },
    [activeSortId, state, showToast, activeSort?.notes],
  )

  const applyAgronomistPreset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      ...AGRONOMIST_PURONEN_PRESET,
      cropType: 'both',
      density: AGRONOMIST_PURONEN_DENSITY,
    }))
    showToast(`Опрос агронома: ${AGRONOMIST_PURONEN_DENSITY} раст/м², без привязки к сорту. Укажите площадь фермы.`)
  }, [setState, showToast])

  const handleNotesChange = useCallback(
    (notes: string) => {
      const next = updateSortNotes(sortsCollectionRef.current, activeSortId, notes)
      sortsCollectionRef.current = next
      setSorts(next.sorts)
    },
    [activeSortId],
  )

  const handleExportSorts = useCallback(() => {
    const saved = persistFromCalculator(sortsCollectionRef.current, state, activeSortId, activeSort?.notes)
    const blob = new Blob([exportSortsJson(saved)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'berry-sorts.json'
    link.click()
    URL.revokeObjectURL(url)
    showToast('Сорта экспортированы в JSON.')
  }, [activeSortId, state, showToast, activeSort?.notes])

  const handleImportSorts = useCallback(
    (text: string) => {
      const imported = importSortsJson(text)
      if (!imported) {
        showToast('Не удалось прочитать файл сортов.')
        return
      }
      const saved = persistFromCalculator(sortsCollectionRef.current, state, activeSortId, activeSort?.notes)
      const next = replaceSortsCollection({ ...imported, farm: saved.farm })
      sortsCollectionRef.current = next
      setSorts(next.sorts)
      setActiveSortId(next.activeSortId)
      const target = next.sorts.find((s) => s.id === next.activeSortId) ?? next.sorts[0]
      setStateRaw(mergeToCalculatorState(next.farm, target.params))
      showToast(`Импортировано сортов: ${next.sorts.length}`)
    },
    [activeSortId, state, showToast, activeSort?.notes],
  )

  const updateCommonField = (
    key: 'density' | 'farmAreaM2' | 'uncertaintyPct',
    value: number,
  ) => {
    setState((prev) => {
      if (key === 'density') return { ...prev, density: clamp(value, 1, 90) }
      if (key === 'farmAreaM2') return { ...prev, farmAreaM2: clamp(value, 1) }
      return { ...prev, uncertaintyPct: clamp(value, 0, 30) }
    })
  }

  const updateQualityField = (key: QualityField, value: number) => {
    setState((prev) => ({
      ...prev,
      [key]: normalizeFactor(value, 0.3, 1),
    }))
  }

  const updateSdWeeklyShare = (weekIndex: number, value: number) => {
    setState((prev) => {
      const next = [...prev.sdWeeklyShares]
      next[weekIndex] = clamp(value, 0, 1)
      return { ...prev, sdWeeklyShares: next }
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

  const compareAxes = useMemo(() => {
    const sdMax = maxOf(SCENARIOS.map((s) => sdResult[s].marketShelfM2PerYear))
    const dnMax = maxOf(SCENARIOS.map((s) => dnResult[s].marketShelfM2PerYear))
    return compareDualAxes(sdMax, dnMax)
  }, [sdResult, dnResult])

  const uncertaintyAxes = useMemo(() => {
    const sdMax = maxOf([uncertaintySD.p10, uncertaintySD.p50, uncertaintySD.p90])
    const dnMax = maxOf([uncertaintyDN.p10, uncertaintyDN.p50, uncertaintyDN.p90])
    return compareDualAxes(sdMax, dnMax)
  }, [uncertaintySD, uncertaintyDN])

  const farmMonthlyAxes = useMemo(() => {
    const sdVals = farmMonthlyData.map((row) => (typeof row.КСД === 'number' ? row.КСД : 0))
    const dnVals = farmMonthlyData.map((row) => (typeof row.НСД === 'number' ? row.НСД : 0))
    return {
      sd: buildDenseAxis(maxOf(sdVals), { minStep: 1, tickCount: 6 }),
      dn: buildDenseAxis(maxOf(dnVals), { minStep: 1, tickCount: 6 }),
    }
  }, [farmMonthlyData])

  const dnCalendarAxis = useMemo(
    () => buildDenseAxis(maxOf(dnCalendar), { minStep: 0.5, tickCount: 6 }),
    [dnCalendar],
  )

  const dnProfileAxis = useMemo(() => {
    const maxKg = maxOf(dnCycleProfileData.map((point) => point.marketKgPerMonth))
    const cycleMonths = state.dnManualProfileEnabled ? 12 : state.dnCycleMonths[calendarScenario]
    const xStep = cycleMonths <= 9 ? 1 : 2
    return {
      y: buildDenseAxis(maxKg, { minStep: 0.5, tickCount: 6 }),
      xTicks: buildMonthAxisTicks(cycleMonths, xStep),
      cycleMonths,
      establish: state.dnEstablishMonths[calendarScenario],
    }
  }, [dnCycleProfileData, state.dnManualProfileEnabled, state.dnCycleMonths, state.dnEstablishMonths, calendarScenario])

  const sdProfileAxis = useMemo(() => {
    const maxKg = maxOf(sdCycleProfileData.map((point) => point.marketKgPerMonth))
    const cycleMonths = state.sdCycleMonths[calendarScenario]
    const xStep = cycleMonths <= 6 ? 0.5 : 1
    return {
      y: buildDenseAxis(maxKg, { minStep: 0.5, tickCount: 6 }),
      xTicks: buildMonthAxisTicks(cycleMonths, xStep),
      cycleMonths,
      fruitingWeeks: state.sdFruitingWeeks,
    }
  }, [sdCycleProfileData, state.sdCycleMonths, state.sdFruitingWeeks, calendarScenario])

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
        'Валовый кг/м2 поверхности·мес',
        'Валовый кг/м2 поверхности/год',
        'Биологический кг/м2 поверхности·мес',
        'Биологический кг/м2 поверхности/год',
        'Товарный кг/м2 поверхности·мес',
        'Товарный кг/м2 поверхности/год',
        'Ферма товарный кг/мес',
        'Ферма товарный кг/год',
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
            formatValue(yearlyToMonthly(result[scenario].grossShelfM2PerYear), 2),
            formatValue(result[scenario].grossShelfM2PerYear, 2),
            formatValue(yearlyToMonthly(result[scenario].bioShelfM2PerYear), 2),
            formatValue(result[scenario].bioShelfM2PerYear, 2),
            formatValue(yearlyToMonthly(result[scenario].marketShelfM2PerYear), 2),
            formatValue(result[scenario].marketShelfM2PerYear, 2),
            formatValue(result[scenario].farmMarketMonthlyKg, 2),
            formatValue(result[scenario].farmMarketAnnualKg, 2),
            formatValue(result[scenario].productiveMonths, 2),
            formatValue(result[scenario].productiveMonthMarketKg, 2),
          ].join(';'),
        )
      })
    })

    rows.push('')
    rows.push(`Коэффициент потерь;${state.kLosses}`)
    rows.push(`Коэффициент рисков;${state.kPests}`)
    rows.push(`Доля товарной ягоды мин;${state.packout.min}`)
    rows.push(`Доля товарной ягоды сред;${state.packout.avg}`)
    rows.push(`Доля товарной ягоды макс;${state.packout.max}`)
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
    const needCompare = sectionIds.some((id) => id === 'sorts-compare' || id === 'sorts-econ')
    const needEcon = sectionIds.includes('econ')
    const prevCompare = compareSortsOpen
    const prevEcon = econOpen
    if (needCompare) setCompareSortsOpen(true)
    if (needEcon) setEconOpen(true)
    if (needCompare || needEcon) await waitForPdfPaint(450)

    try {
      const date = new Date().toLocaleDateString('ru-RU')
      await exportSectionsToPdf(sectionIds, {
        title: 'Калькулятор урожайности клубники · Daogreen',
        subtitle: 'Daogreen — проектирование и запуск вертикальных ферм',
        date,
        lines: [
          { label: 'Культура', value: cropTypeLabel },
          {
            label: 'База расчёта',
            value: 'полезная посевная площадь',
          },
          { label: 'Сорт', value: activeSort?.name ?? '—' },
          { label: 'Плотность', value: `${state.density} раст/м²` },
          { label: 'Площадь фермы', value: `${state.farmAreaM2} м²` },
          {
            label: 'КСД (средний)',
            value: `${fmtSqmMoYear(sdResult.avg.marketM2PerMonth, sdResult.avg.marketM2PerYear)} кг/м²·мес · кг/м²/год`,
          },
          {
            label: 'НСД (средний)',
            value: `${fmtSqmMoYear(dnResult.avg.marketM2PerMonth, dnResult.avg.marketM2PerYear)} кг/м²·мес · кг/м²/год`,
          },
        ],
      })
      setPdfDialogOpen(false)
      showToast('PDF сохранён на устройство.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось сформировать PDF.'
      showToast(message)
    } finally {
      setCompareSortsOpen(prevCompare)
      setEconOpen(prevEcon)
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
    const targetCore = clamp(targetMarketRatio / state.packout.avg, 0.3, 1.2)
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
    <main className={`app ${clientMode ? 'client-mode' : ''} ${stickyVisible ? 'has-sticky-summary' : ''}`}>
      <Toast message={toast} />
      <StickySummary
        cropType={state.cropType}
        sdAvg={sdResult.avg.marketM2PerYear}
        dnAvg={dnResult.avg.marketM2PerYear}
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
          density={state.density}
          farmAreaM2={state.farmAreaM2}
          onCropType={(cropType) => setState((prev) => ({ ...prev, cropType }))}
          onDensity={(density) => updateCommonField('density', density)}
          onFarmArea={(farmAreaM2) => updateCommonField('farmAreaM2', farmAreaM2)}
          kLosses={state.kLosses}
          kPests={state.kPests}
          packout={state.packout.avg}
          onKLosses={(value) => updateQualityField('kLosses', value)}
          onKPests={(value) => updateQualityField('kPests', value)}
          onPackout={(value) =>
            setState((prev) => ({
              ...prev,
              packout: { min: value, avg: value, max: value },
            }))
          }
          onStep={setWizardStep}
          onClose={closeWizard}
        />
      )}

      <header className="header no-print">
        <div className="header-top">
          <div className="header-brand">
            <span className="brand-mark" aria-hidden="true">
              DG
            </span>
            <div>
              <p className="brand-eyebrow">Daogreen</p>
              <h1>Калькулятор урожайности клубники</h1>
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
            <button
              type="button"
              className="ghost-btn header-add-sort"
              onClick={handleAddSort}
              disabled={sorts.length >= MAX_SORTS}
            >
              + Сорт
            </button>
            {canUndo && (
              <button type="button" className="ghost-btn" onClick={undo} title="Ctrl+Z">
                Отменить
              </button>
            )}
          </div>
        </div>

        <p className="header-lead">
          Проектирование и запуск вертикальных ферм. Расчёт валового, биологического и товарного урожая КСД и НСД
          с настройкой сценариев, волн и рисков.
        </p>

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
          <div className="sort-quick-controls">
            <div className="sort-quick-name">
              Сорт: <strong>{activeSort?.name ?? '—'}</strong>
            </div>
            <div className="sort-quick-actions">
              <button type="button" onClick={() => setCompareSortsOpen((open) => !open)}>
                {compareSortsOpen ? 'Скрыть сравнение' : 'Сравнить сорта'}
              </button>
            </div>
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

      <MobileSortsStrip
        sorts={sorts}
        activeSortId={activeSortId}
        onSelect={selectSort}
        onAdd={handleAddSort}
      />

      <section className="layout">
        <aside className="panel no-print-panel">
          <h2>Параметры</h2>

          <SortsBar
            sorts={sorts}
            activeSortId={activeSortId}
            activeNotes={activeSort?.notes ?? ''}
            compareOpen={compareSortsOpen}
            savedHint={sortsSavedAt ? 'Сохранено' : undefined}
            onSelect={selectSort}
            onDuplicate={handleDuplicateSort}
            onRemove={handleRemoveSort}
            onRename={handleRenameSort}
            onNotesChange={handleNotesChange}
            onToggleCompare={() => setCompareSortsOpen((open) => !open)}
            onExportJson={handleExportSorts}
            onImportJson={handleImportSorts}
          />

          {!clientMode && (
            <div className="agronomist-preset-bar">
              <button type="button" className="ghost-btn" onClick={applyAgronomistPreset}>
                Загрузить опрос агронома
              </button>
              <p className="hint">20 раст/м² · без сорта · Пуронен 06.2026</p>
            </div>
          )}

          {!clientMode && (
          <section className="crop-block guide-block">
            <details className="guide-outer">
              <summary className="guide-outer-summary">Инструкция Daogreen</summary>
            <p className="hint guide-intro">
              Краткое руководство по полям калькулятора. Значок <strong>?</strong> у строки дублирует подсказку.
            </p>
            <details>
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
                <strong>База расчёта:</strong> все значения «кг/м²» считаются на <em>полезную посевную площадь</em>.
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
                  <strong>Плотность:</strong> линейно влияет на урожай на м² полезной посевной площади.
                </li>
                <li>
                  <strong>Посевная полезная площадь фермы, м²:</strong> масштабирует итог на всю площадку (кг/год, кг/мес).
                </li>
                <li>
                  <strong>Неопределённость %:</strong> ширина коридора на графике 10/50/90% (симуляция разброса).
                  Сценарии Мин/Средний/Макс и основные карточки не меняет.
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
                  <strong>Карточки сценариев:</strong> товарный урожай; цветовая шкала — сравнение с типовыми
                  диапазонами подтверждённого и потолочного урожая.
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
                Кнопка «Выгрузка PDF» открывает список разделов: титул, результаты, графики. Можно выбрать
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
            <details className="agronomist-guide">
              <summary>Опросник агронома (Пуронен, 06.2026)</summary>
              <p className="hint">
                Кнопка «Загрузить опрос агронома» подставляет значения ниже. В полях «Выход с куста» —{' '}
                <strong>валовый</strong> урожай (г → кг, делите на 1000). Товарный = валовый × доля товарной ягоды.
              </p>
              <ul className="guide-list">
                <li>
                  <strong>КСД, валовый (кг/куст/цикл):</strong> Мин 0,3 · Средний 0,6 · Макс 1,1 (300–1200 г).
                  <strong> Товарный ориентир:</strong> 0,2 / 0,55 / 0,95 кг/куст/цикл — через долю товарной ягоды (~0,85).
                </li>
                <li>
                  <strong>КСД, плодоношение:</strong> ~6 недель; распределение по неделям 10-10-20-35-20-5%. В модели
                  помесячный сбор усреднён; недельный профиль пока не задаётся.
                </li>
                <li>
                  <strong>НСД, валовый (кг/куст/условный год):</strong> Мин 0,5 · Средний 0,75 · Макс 1,35.
                  <strong> Товарный ориентир:</strong> 0,5 / 0,6 / 0,9. Условный год — период плодоношения, обычно до 8–9 мес.
                </li>
                <li>
                  <strong>НСД, цикл / установление / оборот (мес):</strong> цикл 6–7,5–9; установление 4–5–6; оборот 4–5–6
                  (смена когорты, зимовка в холодильнике — нормальная практика).
                </li>
                <li>
                  <strong>НСД, волны:</strong> планируйте 2; 3-я — редкие сорта. Доли ~20-50-30% (3 волны) или ~35/65 (2 волны).
                  Между волнами полного стопа нет. Первая волна: фриго ~10–15% урожая цикла, трей до ~30%; повреждённые
                  цветоносы сильно снижают результат.
                </li>
              </ul>
              <p className="hint">{AGRONOMIST_PURONEN_SORT_NOTE}</p>
            </details>
            <p className="hint guide-footer">Daogreen · daogreen.ru · модель даёт ориентиры, не заменяет пилотный прогон.</p>
            </details>
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
            <>
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
            <p className="hint uncertainty-hint">
              Это не сценарии «Мин/Средний/Макс» — они задаются вручную выше. Неопределённость управляет только
              графиком <strong>10% / 50% / 90%</strong>: при {state.uncertaintyPct}% модель многократно случайно
              варьирует урожай с куста, длину цикла и коэффициенты качества в пределах ваших диапазонов и показывает,
              насколько может разъехаться итог. 0% — узкий коридор вокруг среднего; 30% — широкий, «осторожный».
            </p>
            </>
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
            <TripleInputs
              title="Доля товарной ягоды"
              unit="0…1"
              hint={FIELD_HINTS.packout}
              clientMode={clientMode}
              values={state.packout}
              min={0.4}
              max={1}
              step={0.01}
              onChange={(scenario, value) => updateTripleField('packout', scenario, value)}
            />
            <p className="hint">
              Товарный урожай = биологический × доля товарной ягоды (какая часть идёт в продажу, не в отход).
              По опроснику агронома: КСД ~0,67 / 0,92 / 0,86; НСД отличается — задайте Мин / Средний / Макс
              отдельно.
            </p>
            <p className="hint">
              Итог: коэффициент качества = {formatValue(coreFactor, 3)}, коэффициент товарного выхода (средний
              сценарий) = {formatValue(totalMarketFactor, 3)}
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
              {!clientMode && (
                <details>
                  <summary>Недельный профиль плодоношения КСД</summary>
                  <label className="field">
                    <HintLabel
                      label="Недель плодоношения в конце цикла"
                      hint="Сбор идёт в последние N недель цикла; типично 6 недель по опроснику агронома."
                    />
                    <input
                      type="number"
                      min={1}
                      max={12}
                      step={1}
                      value={state.sdFruitingWeeks}
                      onChange={(event) =>
                        setState((prev) => ({
                          ...prev,
                          sdFruitingWeeks: clamp(Number(event.target.value), 1, 12),
                        }))
                      }
                    />
                  </label>
                  <p className="hint">
                    Доли урожая по неделям (нормализуются к 100%). Ориентир Пуронен: 10-10-20-35-20-5%.
                  </p>
                  <div className="manual-month-grid">
                    {Array.from({ length: state.sdFruitingWeeks }, (_, index) => (
                      <label key={`sd-week-${index}`} className="field manual-month-cell">
                        <span>Нед {index + 1}</span>
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.01}
                          value={state.sdWeeklyShares[index] ?? 0}
                          onChange={(event) => updateSdWeeklyShare(index, Number(event.target.value))}
                        />
                      </label>
                    ))}
                  </div>
                </details>
              )}
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
              <label className="field">
                <HintLabel
                  label="Тип рассады НСД (1-я волна)"
                  hint="Фриго даёт ~12,5% урожая цикла на 1-ю волну, хорошо разогнанный трей — ~27,5%. В режиме «Вручную» доли волн задаются ниже."
                />
                <select
                  value={state.dnSeedlingMaterial}
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      dnSeedlingMaterial: event.target.value as DnSeedlingMaterial,
                    }))
                  }
                >
                  <option value="manual">Вручную (доли волн)</option>
                  <option value="frigo">Фриго</option>
                  <option value="tray">Трей (разогнанная рассада)</option>
                </select>
              </label>
              <TripleInputs
                title="Потери от повреждения 1-й цветоносы"
                unit="доля"
                hint="Снижает только 1-ю волну: 0,15 = минус 15% от её вклада. По опроснику: до 15% (мин) / 5% (сред) / 0% (макс)."
                clientMode={clientMode}
                values={state.dnInflorescenceLoss}
                min={0}
                max={0.95}
                step={0.01}
                onChange={(scenario, value) => updateTripleField('dnInflorescenceLoss', scenario, value)}
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
            <button type="button" onClick={() => setEconOpen((v) => !v)}>
              {econOpen ? 'Скрыть экономику' : 'Экономика'}
            </button>
          </div>
          {linkStatus && <p className="status">{linkStatus}</p>}
        </aside>

        <section className="results print-area">
          <div className="print-only print-header">
            <h2>Калькулятор урожая клубники — отчёт · Daogreen</h2>
            <p>
              Сорт: {activeSort?.name ?? '—'} · плотность {state.density} раст/м² · площадь {state.farmAreaM2} м² ·
              база: полезная посевная площадь
            </p>
          </div>

          {compareSortsOpen && sorts.length > 0 && (
            <SortComparePanel
              sorts={sorts}
              results={sortCompareResults}
              activeSortId={activeSortId}
              cropType={state.cropType}
              insights={sortInsights}
              onSelect={selectSort}
            />
          )}

          {compareSortsOpen && sortEconRows.length > 0 && (
            <SortEconComparePanel
              rows={sortEconRows}
              insights={sortInsights}
              activeSortId={activeSortId}
              onSelect={selectSort}
            />
          )}

          <p className="active-sort-label no-print">
            Расчёт для сорта: <strong>{activeSort?.name ?? '—'}</strong>
          </p>

          <CalculationSummary state={state} sdResult={sdResult} dnResult={dnResult} />

          {!clientMode && (
          <section className="chart-card model-limits-card" id="pdf-sec-model-limits">
            <h3>Ограничения модели и факторы риска</h3>
            <p className="hint model-disclaimer">{MODEL_DISCLAIMER}</p>
            <ModelCaveatsBlock items={MODEL_LIMITATIONS_BULLETS.slice(1)} />
          </section>
          )}

          {(state.cropType === 'SD' || state.cropType === 'both') && (
            <div id="pdf-sec-results-sd">
              <ResultsTable crop="SD" title="Результаты КСД" result={sdResult} clientMode={clientMode} />
            </div>
          )}
          {(state.cropType === 'DN' || state.cropType === 'both') && (
            <div id="pdf-sec-results-dn">
              <ResultsTable crop="DN" title="Результаты НСД" result={dnResult} clientMode={clientMode} />
            </div>
          )}

          <section className="chart-card" id="pdf-sec-chart-compare">
            <h3>Сравнение КСД и НСД (товарный урожай, кг/м²·мес · кг/м²/год)</h3>
            <ChartExplainBlock id="compare" />
            <div className="chart-wrap chart-wrap-tall">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={state.cropType === 'both' ? CHART_MARGIN.dual : CHART_MARGIN.compact}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="scenario" />
                  {(state.cropType === 'SD' || state.cropType === 'both') && (
                    <YAxis
                      yAxisId="sd"
                      orientation="left"
                      domain={compareAxes.sd.domain}
                      ticks={compareAxes.sd.ticks}
                      label={{
                        value: 'КСД, кг/м²/год',
                        angle: -90,
                        position: 'insideLeft',
                        offset: 10,
                      }}
                    />
                  )}
                  {(state.cropType === 'DN' || state.cropType === 'both') && (
                    <YAxis
                      yAxisId="dn"
                      orientation={state.cropType === 'both' ? 'right' : 'left'}
                      domain={compareAxes.dn.domain}
                      ticks={compareAxes.dn.ticks}
                      label={{
                        value: state.cropType === 'both' ? 'НСД, кг/м²/год' : 'НСД, кг/м²/год',
                        angle: state.cropType === 'both' ? 90 : -90,
                        position: state.cropType === 'both' ? 'insideRight' : 'insideLeft',
                        offset: 10,
                      }}
                    />
                  )}
                  <Tooltip content={<YieldSqmTooltip />} />
                  {(state.cropType === 'SD' || state.cropType === 'both') && (
                    <Bar yAxisId="sd" dataKey="КСД" fill={CHART.sd} name="КСД">
                      <LabelList content={<YieldBarTopLabel />} />
                    </Bar>
                  )}
                  {(state.cropType === 'DN' || state.cropType === 'both') && (
                    <Bar yAxisId="dn" dataKey="НСД" fill={CHART.dn} name="НСД">
                      <LabelList content={<YieldBarTopLabel />} />
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ChartLegendRow items={compareLegend} />
            <p className="hint chart-footnote">
              Над столбцами — товарный урожай в кг/м²·мес · кг/м²/год. При режиме «оба» у КСД и НСД отдельные
              шкалы: НСД читается по правой оси с более частыми делениями.
            </p>
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
            <ChartExplainBlock id="sensitivity" />
            <div className="table-wrap">
              <table className="sensitivity-table">
                <thead>
                  <tr>
                    <th>Вариант</th>
                    {(state.cropType === 'SD' || state.cropType === 'both') && (
                      <>
                        <th>КСД, {YIELD_COL.sqm}</th>
                        <th>КСД, {YIELD_COL.farm} фермы</th>
                      </>
                    )}
                    {(state.cropType === 'DN' || state.cropType === 'both') && (
                      <>
                        <th>НСД, {YIELD_COL.sqm}</th>
                        <th>НСД, {YIELD_COL.farm} фермы</th>
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
                          <td>{fmtSqmMoYear(line.sdM2PerMonth, line.sd)}</td>
                          <td>{fmtFarmMoYear(line.sdFarmMonthlyKg, line.sdFarmKg)}</td>
                        </>
                      )}
                      {(state.cropType === 'DN' || state.cropType === 'both') && (
                        <>
                          <td>{fmtSqmMoYear(line.dnM2PerMonth, line.dn)}</td>
                          <td>{fmtFarmMoYear(line.dnFarmMonthlyKg, line.dnFarmKg)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint">
              Показывает, как меняется товарный урожай при отклонении плотности и/или выхода с куста на выбранный
              процент. База: полезная посевная площадь, площадь фермы {formatValue(state.farmAreaM2, 1)} м².
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
            <ChartExplainBlock id="farm-monthly" />
            <div className="chart-wrap chart-wrap-tall">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={farmMonthlyData}
                  margin={state.cropType === 'both' ? CHART_MARGIN.dual : CHART_MARGIN.compact}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  {(state.cropType === 'SD' || state.cropType === 'both') && (
                    <YAxis
                      yAxisId="sd"
                      orientation="left"
                      domain={farmMonthlyAxes.sd.domain}
                      ticks={farmMonthlyAxes.sd.ticks}
                      label={{ value: 'КСД, кг', angle: -90, position: 'insideLeft', offset: 8 }}
                    />
                  )}
                  {(state.cropType === 'DN' || state.cropType === 'both') && (
                    <YAxis
                      yAxisId="dn"
                      orientation={state.cropType === 'both' ? 'right' : 'left'}
                      domain={farmMonthlyAxes.dn.domain}
                      ticks={farmMonthlyAxes.dn.ticks}
                      label={{
                        value: 'НСД, кг',
                        angle: state.cropType === 'both' ? 90 : -90,
                        position: state.cropType === 'both' ? 'insideRight' : 'insideLeft',
                        offset: 8,
                      }}
                    />
                  )}
                  <Tooltip content={<KgTooltip />} />
                  {(state.cropType === 'SD' || state.cropType === 'both') && (
                    <Bar yAxisId="sd" dataKey="КСД" fill={CHART.sd} name="КСД, кг с фермы" />
                  )}
                  {(state.cropType === 'DN' || state.cropType === 'both') && (
                    <Bar yAxisId="dn" dataKey="НСД" fill={CHART.dn} name="НСД, кг с фермы" />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ChartLegendRow items={farmLegend} />
            <p className="hint chart-footnote">
              <strong>КСД:</strong> ротация когорт с недельным профилем 10-10-20-35-20-5% в конце цикла (пики
              смещены к завершению цикла).
              <br />
              <strong>НСД:</strong> волны плодоношения 6–9 мес, когорты кустов стартуют со сдвигом — урожай
              распределён по сезону, не в 1–2 месяца. Пик суммарного сбора:{' '}
              <strong>
                {peakFarmMonth.month} — {formatValue(peakFarmMonth.kg, 0)} кг
              </strong>{' '}
              при площади {formatValue(state.farmAreaM2, 1)} м².
            </p>
          </section>

          {!clientMode && (state.cropType === 'SD' || state.cropType === 'both') && (
          <section className="chart-card" id="pdf-sec-chart-sd-profile">
            <h3>Профиль плодоношения внутри цикла КСД (товарный кг/м²·мес)</h3>
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
            <ChartExplainBlock id="sd-profile" />
            <div className="chart-wrap chart-wrap-tall">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sdCycleProfileData} margin={CHART_MARGIN.line}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    type="number"
                    domain={[0, sdProfileAxis.cycleMonths]}
                    ticks={sdProfileAxis.xTicks}
                    tickFormatter={(value) => Number(value).toFixed(1)}
                    label={{ value: 'Месяц цикла', position: 'bottom', offset: 8 }}
                  />
                  <YAxis
                    domain={sdProfileAxis.y.domain}
                    ticks={sdProfileAxis.y.ticks}
                    label={{ value: 'кг/м²·мес', angle: -90, position: 'insideLeft', offset: 8 }}
                  />
                  <Tooltip content={<SqmMonthTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="marketKgPerMonth"
                    stroke={CHART.sd}
                    strokeWidth={2}
                    dot={false}
                    name="кг/м²·мес"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="hint chart-footnote">
              Плодоношение ~{sdProfileAxis.fruitingWeeks} нед в конце цикла {formatValue(sdProfileAxis.cycleMonths, 1)}{' '}
              мес; доли по неделям — из параметров КСД (ориентир 10-10-20-35-20-5%).
            </p>
          </section>
          )}

          {econOpen && (
            <BerryEconPanel
              econ={econ}
              onChange={setEcon}
              farmAreaM2={state.farmAreaM2}
              cropType={state.cropType}
              sdResult={sdResult}
              dnResult={dnResult}
            />
          )}

          {!clientMode && (
          <section className="chart-card" id="pdf-sec-chart-uncertainty">
            <h3>Диапазон неопределенности 10/50/90% (товарный кг/м²·мес · кг/м²/год)</h3>
            <ChartExplainBlock id="uncertainty" />
            <div className="chart-wrap chart-wrap-tall">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={percentileChartData}
                  margin={state.cropType === 'both' ? CHART_MARGIN.dual : CHART_MARGIN.compact}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="p" />
                  {(state.cropType === 'SD' || state.cropType === 'both') && (
                    <YAxis
                      yAxisId="sd"
                      orientation="left"
                      domain={uncertaintyAxes.sd.domain}
                      ticks={uncertaintyAxes.sd.ticks}
                      label={{ value: 'КСД, кг/м²/год', angle: -90, position: 'insideLeft', offset: 10 }}
                    />
                  )}
                  {(state.cropType === 'DN' || state.cropType === 'both') && (
                    <YAxis
                      yAxisId="dn"
                      orientation={state.cropType === 'both' ? 'right' : 'left'}
                      domain={uncertaintyAxes.dn.domain}
                      ticks={uncertaintyAxes.dn.ticks}
                      label={{
                        value: 'НСД, кг/м²/год',
                        angle: state.cropType === 'both' ? 90 : -90,
                        position: state.cropType === 'both' ? 'insideRight' : 'insideLeft',
                        offset: 10,
                      }}
                    />
                  )}
                  <Tooltip content={<YieldSqmTooltip />} />
                  {(state.cropType === 'SD' || state.cropType === 'both') && (
                    <Bar yAxisId="sd" dataKey="КСД" fill={CHART.sdSoft} name="КСД">
                      <LabelList content={<YieldBarTopLabel />} />
                    </Bar>
                  )}
                  {(state.cropType === 'DN' || state.cropType === 'both') && (
                    <Bar yAxisId="dn" dataKey="НСД" fill={CHART.dnSoft} name="НСД">
                      <LabelList content={<YieldBarTopLabel />} />
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ChartLegendRow items={uncertaintyLegend} />
            <p className="hint chart-footnote">
              Монте-Карло: случайные прогоны в пределах ваших Мин/Макс и неопределённости {state.uncertaintyPct}%.
              Нижняя 10% — осторожная оценка, 50% — медиана, 90% — оптимистичная. Карточки сценариев выше — отдельно,
              они задаются вручную.
              <br />
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
            <ChartExplainBlock id="dn-calendar" />
            <div className="chart-wrap chart-wrap-tall">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dnCalendarData} margin={CHART_MARGIN.compact}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis
                    domain={dnCalendarAxis.domain}
                    ticks={dnCalendarAxis.ticks}
                    label={{ value: 'кг/м²·мес', angle: -90, position: 'insideLeft', offset: 8 }}
                  />
                  <Tooltip content={<SqmMonthTooltip />} />
                  <Bar dataKey="marketKg" fill={CHART.sky} name="кг/м²·мес">
                    <LabelList content={<KgBarTopLabel />} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="hint chart-footnote">
              {state.dnManualProfileEnabled
                ? 'Календарь из вашего ручного помесячного профиля.'
                : 'Сезон НСД на 1 м²: волны + перекрывающиеся когорты кустов (как на помесячном графике фермы).'}
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
            <ChartExplainBlock id="dn-profile" />
            <div className="chart-wrap chart-wrap-tall">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dnCycleProfileData} margin={CHART_MARGIN.line}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    type="number"
                    domain={[0, dnProfileAxis.cycleMonths]}
                    ticks={dnProfileAxis.xTicks}
                    tickFormatter={(value) => Number(value).toFixed(1)}
                    label={{
                      value: state.dnManualProfileEnabled ? 'Месяц года' : 'Месяц цикла',
                      position: 'bottom',
                      offset: 8,
                    }}
                  />
                  <YAxis
                    domain={dnProfileAxis.y.domain}
                    ticks={dnProfileAxis.y.ticks}
                    label={{ value: 'кг/м²·мес', angle: -90, position: 'insideLeft', offset: 8 }}
                  />
                  <Tooltip content={<SqmMonthTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="marketKgPerMonth"
                    stroke={CHART.berry}
                    strokeWidth={2}
                    dot={false}
                    name="кг/м²·мес"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="hint chart-footnote">
              {state.dnManualProfileEnabled
                ? 'Линия строится из 12 заданных вами помесячных значений на растение.'
                : `До ~${formatValue(dnProfileAxis.establish, 1)} мес — установление когорты без сбора; затем пики 1-й и 2-й волны и спад в конце цикла.`}
            </p>
          </section>
          )}
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
