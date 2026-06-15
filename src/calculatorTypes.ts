import type { AreaBasis, CropType, Triple } from './types'

export interface CalculatorState {
  cropType: CropType
  areaBasis: AreaBasis
  density: number
  tiers: number
  farmAreaM2: number
  kLosses: number
  kPests: number
  packout: number
  uncertaintyPct: number
  sdYieldPerPlant: Triple
  sdCycleMonths: Triple
  dnYieldPerPlant: Triple
  dnCycleMonths: Triple
  dnTurnaroundMonths: Triple
  dnWaves: Triple
  dnEstablishMonths: Triple
  dnWave1Share: Triple
  dnWave2Share: Triple
  dnManualProfileEnabled: boolean
  dnManualMonthlyPlantYield: number[]
  berryMassG: Triple
}

export interface ScenarioResult {
  cyclesPerYear: number
  grossPlantPerYear: number
  grossShelfM2PerCycle: number
  grossShelfM2PerYear: number
  grossFloorM2PerYear: number
  bioShelfM2PerYear: number
  marketShelfM2PerYear: number
  marketFloorM2PerYear: number
  marketMainM2PerYear: number
  marketMainM2PerMonth: number
  farmMarketAnnualKg: number
  farmMarketMonthlyKg: number
  productiveMonths: number | null
  productiveMonthMarketKg: number | null
  productiveMonthError: string | null
}

export type CropResult = Record<import('./types').Scenario, ScenarioResult>
