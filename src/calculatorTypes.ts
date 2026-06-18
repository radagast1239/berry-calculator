import type { CropType, Triple } from './types'
import type { DnSeedlingMaterial } from './cropProfileConstants'

export interface CalculatorState {
  cropType: CropType
  density: number
  farmAreaM2: number
  kLosses: number
  kPests: number
  /** Доля товарной ягоды по сценариям Мин / Средний / Макс. */
  packout: Triple
  uncertaintyPct: number
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
  /** Доля потери 1-й волны из-за повреждения цветоносов (0…1). */
  dnInflorescenceLoss: Triple
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
