import type { CropType, Triple } from './types'

export interface CalculatorState {
  cropType: CropType
  density: number
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
  bioShelfM2PerYear: number
  marketShelfM2PerYear: number
  marketM2PerYear: number
  marketM2PerMonth: number
  farmMarketAnnualKg: number
  farmMarketMonthlyKg: number
  productiveMonths: number | null
  productiveMonthMarketKg: number | null
  productiveMonthError: string | null
}

export type CropResult = Record<import('./types').Scenario, ScenarioResult>
