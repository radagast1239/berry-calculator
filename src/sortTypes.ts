import type { CropType, Triple } from './types'
import type { CalculatorState } from './calculatorTypes'
import {
  DEFAULT_SD_FRUITING_WEEKS,
  DEFAULT_SD_WEEKLY_SHARES,
  type DnSeedlingMaterial,
} from './cropProfileConstants'

export const MAX_SORTS = 6

export interface SortParams {
  sdYieldPerPlant: Triple
  sdCycleMonths: Triple
  sdFruitingWeeks: number
  sdWeeklyShares: number[]
  dnYieldPerPlant: Triple
  dnCycleMonths: Triple
  dnTurnaroundMonths: Triple
  dnWaves: Triple
  dnEstablishMonths: Triple
  dnWave1Share: Triple
  dnWave2Share: Triple
  dnSeedlingMaterial: DnSeedlingMaterial
  dnInflorescenceLoss: Triple
  dnManualProfileEnabled: boolean
  dnManualMonthlyPlantYield: number[]
  berryMassG: Triple
}

export interface SortProfile {
  id: string
  name: string
  notes: string
  params: SortParams
}

export interface FarmSettings {
  cropType: CropType
  density: number
  farmAreaM2: number
  kLosses: number
  kPests: number
  packout: Triple
  uncertaintyPct: number
}

export interface SortsCollection {
  version: number
  activeSortId: string
  farm: FarmSettings
  sorts: SortProfile[]
}

export const DEFAULT_SORT_PARAMS: SortParams = {
  sdYieldPerPlant: { min: 0.4, avg: 0.5, max: 0.6 },
  sdCycleMonths: { min: 3, avg: 3, max: 3 },
  sdFruitingWeeks: DEFAULT_SD_FRUITING_WEEKS,
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

export const DEFAULT_FARM: FarmSettings = {
  cropType: 'both',
  density: 20,
  farmAreaM2: 1,
  kLosses: 1,
  kPests: 1,
  packout: { min: 1, avg: 1, max: 1 },
  uncertaintyPct: 8,
}

const newSortIdSuffix = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 8)
  }
  return Math.random().toString(36).slice(2, 10)
}

export function createSortProfile(
  index: number,
  params: SortParams = DEFAULT_SORT_PARAMS,
  name?: string,
  notes = '',
): SortProfile {
  return {
    id: `sort-${index}-${newSortIdSuffix()}`,
    name: name?.trim().slice(0, 40) || `Сорт ${index}`,
    notes: notes.slice(0, 500),
    params: JSON.parse(JSON.stringify(params)) as SortParams,
  }
}

export function extractSortParams(state: CalculatorState): SortParams {
  return {
    sdYieldPerPlant: { ...state.sdYieldPerPlant },
    sdCycleMonths: { ...state.sdCycleMonths },
    sdFruitingWeeks: state.sdFruitingWeeks,
    sdWeeklyShares: [...state.sdWeeklyShares],
    dnYieldPerPlant: { ...state.dnYieldPerPlant },
    dnCycleMonths: { ...state.dnCycleMonths },
    dnTurnaroundMonths: { ...state.dnTurnaroundMonths },
    dnWaves: { ...state.dnWaves },
    dnEstablishMonths: { ...state.dnEstablishMonths },
    dnWave1Share: { ...state.dnWave1Share },
    dnWave2Share: { ...state.dnWave2Share },
    dnSeedlingMaterial: state.dnSeedlingMaterial,
    dnInflorescenceLoss: { ...state.dnInflorescenceLoss },
    dnManualProfileEnabled: state.dnManualProfileEnabled,
    dnManualMonthlyPlantYield: [...state.dnManualMonthlyPlantYield],
    berryMassG: { ...state.berryMassG },
  }
}

export function extractFarmSettings(state: CalculatorState): FarmSettings {
  return {
    cropType: state.cropType,
    density: state.density,
    farmAreaM2: state.farmAreaM2,
    kLosses: state.kLosses,
    kPests: state.kPests,
    packout: { ...state.packout },
    uncertaintyPct: state.uncertaintyPct,
  }
}

export function mergeToCalculatorState(farm: FarmSettings, sort: SortParams): CalculatorState {
  return {
    ...farm,
    ...sort,
    packout: { ...farm.packout },
    sdWeeklyShares: [...sort.sdWeeklyShares],
    dnManualMonthlyPlantYield: [...sort.dnManualMonthlyPlantYield],
    dnInflorescenceLoss: { ...sort.dnInflorescenceLoss },
  }
}
