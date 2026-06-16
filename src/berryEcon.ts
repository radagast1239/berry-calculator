import type { Scenario } from './types'

export interface BerryEconState {
  salePriceRubPerKg: number
  variableCostRubPerKg: number
  packagingRubPerKg: number
  salesFeePct: number
  electricityRubPerMonth: number
  rentRubPerMonth: number
  payrollRubPerMonth: number
  maintenanceRubPerMonth: number
  adminRubPerMonth: number
  otherRubPerMonth: number
  capexEquipmentRub: number
  capexInstallRub: number
  capexCommissioningRub: number
  capexWorkingCapitalRub: number
  taxPct: number
  discountRatePct: number
  horizonYears: number
}

export interface BerryEconKgInput {
  monthlyKg: number
  annualKg: number
}

export interface BerryEconInputs {
  scenarios: Record<Scenario, BerryEconKgInput>
  farmAreaM2: number
}

export interface BerryEconResult {
  revenueRubPerMonth: number
  revenueRubPerYear: number
  salesFeeRubPerMonth: number
  variableRubPerMonth: number
  fixedRubPerMonth: number
  ebitdaRubPerMonth: number
  ebitdaRubPerYear: number
  taxRubPerMonth: number
  netProfitRubPerMonth: number
  netProfitRubPerYear: number
  contributionRubPerKg: number
  netUnitProfitRubPerKg: number
  revenueRubPerM2Year: number
  netProfitRubPerM2Year: number
  breakEvenKgPerMonth: number | null
  breakEvenPriceRubPerKg: number | null
  totalCapexRub: number
  paybackMonths: number | null
  roiPct: number | null
  npvRub: number | null
}

export interface BerryEconAllScenarios {
  min: BerryEconResult
  avg: BerryEconResult
  max: BerryEconResult
}

export const DEFAULT_BERRY_ECON: BerryEconState = {
  salePriceRubPerKg: 800,
  variableCostRubPerKg: 120,
  packagingRubPerKg: 30,
  salesFeePct: 0,
  electricityRubPerMonth: 0,
  rentRubPerMonth: 0,
  payrollRubPerMonth: 0,
  maintenanceRubPerMonth: 0,
  adminRubPerMonth: 0,
  otherRubPerMonth: 0,
  capexEquipmentRub: 0,
  capexInstallRub: 0,
  capexCommissioningRub: 0,
  capexWorkingCapitalRub: 0,
  taxPct: 0,
  discountRatePct: 12,
  horizonYears: 5,
}

/** Миграция старого localStorage (capexRub, logisticsRubPerMonth). */
export function migrateBerryEconState(raw: unknown): BerryEconState {
  const base = { ...DEFAULT_BERRY_ECON }
  if (!raw || typeof raw !== 'object') return base
  const item = raw as Record<string, unknown>
  const num = (key: keyof BerryEconState, fallback: number) => {
    const v = item[key as string]
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback
  }
  const merged: BerryEconState = {
    salePriceRubPerKg: num('salePriceRubPerKg', base.salePriceRubPerKg),
    variableCostRubPerKg: num('variableCostRubPerKg', base.variableCostRubPerKg),
    packagingRubPerKg: num('packagingRubPerKg', base.packagingRubPerKg),
    salesFeePct: num('salesFeePct', base.salesFeePct),
    electricityRubPerMonth: num('electricityRubPerMonth', base.electricityRubPerMonth),
    rentRubPerMonth: num('rentRubPerMonth', base.rentRubPerMonth),
    payrollRubPerMonth: num('payrollRubPerMonth', base.payrollRubPerMonth),
    maintenanceRubPerMonth: num('maintenanceRubPerMonth', base.maintenanceRubPerMonth),
    adminRubPerMonth: num('adminRubPerMonth', base.adminRubPerMonth),
    otherRubPerMonth: num('otherRubPerMonth', base.otherRubPerMonth),
    capexEquipmentRub: num('capexEquipmentRub', base.capexEquipmentRub),
    capexInstallRub: num('capexInstallRub', base.capexInstallRub),
    capexCommissioningRub: num('capexCommissioningRub', base.capexCommissioningRub),
    capexWorkingCapitalRub: num('capexWorkingCapitalRub', base.capexWorkingCapitalRub),
    taxPct: num('taxPct', base.taxPct),
    discountRatePct: num('discountRatePct', base.discountRatePct),
    horizonYears: num('horizonYears', base.horizonYears),
  }
  if (typeof item.capexRub === 'number' && merged.capexEquipmentRub === 0) {
    merged.capexEquipmentRub = Math.max(0, item.capexRub)
  }
  if (typeof item.logisticsRubPerMonth === 'number' && merged.otherRubPerMonth === 0) {
    merged.otherRubPerMonth = Math.max(0, item.logisticsRubPerMonth)
  }
  return merged
}

export function totalCapexRub(econ: BerryEconState): number {
  return (
    Math.max(0, econ.capexEquipmentRub) +
    Math.max(0, econ.capexInstallRub) +
    Math.max(0, econ.capexCommissioningRub) +
    Math.max(0, econ.capexWorkingCapitalRub)
  )
}

function calcNpv(annualCashFlow: number, capex: number, discountRatePct: number, horizonYears: number): number | null {
  if (horizonYears <= 0) return null
  const r = Math.max(0, discountRatePct) / 100
  let npv = -capex
  for (let year = 1; year <= horizonYears; year += 1) {
    npv += annualCashFlow / (1 + r) ** year
  }
  return npv
}

export function calcBerryEconomics(
  econ: BerryEconState,
  input: BerryEconKgInput,
  farmAreaM2: number,
): BerryEconResult {
  const monthlyKg = Math.max(0, input.monthlyKg)
  const annualKg = Math.max(0, input.annualKg)
  const area = Math.max(0.0001, farmAreaM2)

  const price = Math.max(0, econ.salePriceRubPerKg)
  const revenueRubPerMonth = monthlyKg * price
  const revenueRubPerYear = annualKg * price

  const salesFeePct = Math.max(0, Math.min(50, econ.salesFeePct))
  const salesFeeRubPerMonth = revenueRubPerMonth * (salesFeePct / 100)

  const variablePerKg = Math.max(0, econ.variableCostRubPerKg) + Math.max(0, econ.packagingRubPerKg)
  const variableRubPerMonth = monthlyKg * variablePerKg

  const fixedRubPerMonth =
    Math.max(0, econ.electricityRubPerMonth) +
    Math.max(0, econ.rentRubPerMonth) +
    Math.max(0, econ.payrollRubPerMonth) +
    Math.max(0, econ.maintenanceRubPerMonth) +
    Math.max(0, econ.adminRubPerMonth) +
    Math.max(0, econ.otherRubPerMonth)

  const ebitdaRubPerMonth = revenueRubPerMonth - salesFeeRubPerMonth - variableRubPerMonth - fixedRubPerMonth
  const ebitdaRubPerYear = ebitdaRubPerMonth * 12

  const taxPct = Math.max(0, Math.min(50, econ.taxPct))
  const taxable = Math.max(0, ebitdaRubPerMonth)
  const taxRubPerMonth = taxable * (taxPct / 100)
  const netProfitRubPerMonth = ebitdaRubPerMonth - taxRubPerMonth
  const netProfitRubPerYear = netProfitRubPerMonth * 12

  const contributionRubPerKg = Math.max(0, price - variablePerKg - price * (salesFeePct / 100))
  const netUnitProfitRubPerKg = monthlyKg > 0 ? netProfitRubPerMonth / monthlyKg : 0
  const revenueRubPerM2Year = revenueRubPerYear / area
  const netProfitRubPerM2Year = netProfitRubPerYear / area

  const breakEvenKgPerMonth = contributionRubPerKg > 0 ? fixedRubPerMonth / contributionRubPerKg : null
  const breakEvenPriceRubPerKg =
    monthlyKg > 0 && salesFeePct < 100
      ? (variablePerKg + fixedRubPerMonth / monthlyKg) / (1 - salesFeePct / 100)
      : null

  const totalCapex = totalCapexRub(econ)
  const paybackMonths = totalCapex > 0 && netProfitRubPerMonth > 0 ? totalCapex / netProfitRubPerMonth : null
  const roiPct = totalCapex > 0 ? (netProfitRubPerYear / totalCapex) * 100 : null
  const npvRub = calcNpv(netProfitRubPerYear, totalCapex, econ.discountRatePct, econ.horizonYears)

  return {
    revenueRubPerMonth,
    revenueRubPerYear,
    salesFeeRubPerMonth,
    variableRubPerMonth,
    fixedRubPerMonth,
    ebitdaRubPerMonth,
    ebitdaRubPerYear,
    taxRubPerMonth,
    netProfitRubPerMonth,
    netProfitRubPerYear,
    contributionRubPerKg,
    netUnitProfitRubPerKg,
    revenueRubPerM2Year,
    netProfitRubPerM2Year,
    breakEvenKgPerMonth,
    breakEvenPriceRubPerKg,
    totalCapexRub: totalCapex,
    paybackMonths,
    roiPct,
    npvRub,
  }
}

export function calcBerryEconomicsAllScenarios(econ: BerryEconState, input: BerryEconInputs): BerryEconAllScenarios {
  const scenarios: Scenario[] = ['min', 'avg', 'max']
  const out = {} as BerryEconAllScenarios
  scenarios.forEach((scenario) => {
    out[scenario] = calcBerryEconomics(econ, input.scenarios[scenario], input.farmAreaM2)
  })
  return out
}
