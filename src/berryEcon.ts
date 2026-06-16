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
  capexRub: number
  taxPct: number
}

export interface BerryEconInputs {
  monthlyKg: number
  annualKg: number
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
  breakEvenKgPerMonth: number | null
  breakEvenPriceRubPerKg: number | null
  paybackMonths: number | null
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
  capexRub: 0,
  taxPct: 0,
}

export function calcBerryEconomics(econ: BerryEconState, input: BerryEconInputs): BerryEconResult {
  const monthlyKg = Math.max(0, input.monthlyKg)
  const annualKg = Math.max(0, input.annualKg)

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

  const breakEvenKgPerMonth =
    contributionRubPerKg > 0 ? fixedRubPerMonth / contributionRubPerKg : null
  const breakEvenPriceRubPerKg =
    monthlyKg > 0 ? (salesFeePct < 100 ? (variablePerKg + fixedRubPerMonth / monthlyKg) / (1 - salesFeePct / 100) : null) : null

  const capex = Math.max(0, econ.capexRub)
  const paybackMonths = capex > 0 && netProfitRubPerMonth > 0 ? capex / netProfitRubPerMonth : null

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
    breakEvenKgPerMonth,
    breakEvenPriceRubPerKg,
    paybackMonths,
  }
}

