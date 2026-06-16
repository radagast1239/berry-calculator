export interface BerryEconState {
  salePriceRubPerKg: number
  variableCostRubPerKg: number
  packagingRubPerKg: number
  electricityRubPerMonth: number
  rentRubPerMonth: number
  payrollRubPerMonth: number
  logisticsRubPerMonth: number
  otherRubPerMonth: number
  capexRub: number
}

export interface BerryEconInputs {
  monthlyKg: number
  annualKg: number
}

export interface BerryEconResult {
  revenueRubPerMonth: number
  revenueRubPerYear: number
  variableRubPerMonth: number
  fixedRubPerMonth: number
  profitRubPerMonth: number
  profitRubPerYear: number
  unitProfitRubPerKg: number
  paybackMonths: number | null
}

export const DEFAULT_BERRY_ECON: BerryEconState = {
  salePriceRubPerKg: 800,
  variableCostRubPerKg: 120,
  packagingRubPerKg: 30,
  electricityRubPerMonth: 0,
  rentRubPerMonth: 0,
  payrollRubPerMonth: 0,
  logisticsRubPerMonth: 0,
  otherRubPerMonth: 0,
  capexRub: 0,
}

export function calcBerryEconomics(econ: BerryEconState, input: BerryEconInputs): BerryEconResult {
  const monthlyKg = Math.max(0, input.monthlyKg)
  const annualKg = Math.max(0, input.annualKg)

  const revenueRubPerMonth = monthlyKg * Math.max(0, econ.salePriceRubPerKg)
  const revenueRubPerYear = annualKg * Math.max(0, econ.salePriceRubPerKg)

  const variablePerKg = Math.max(0, econ.variableCostRubPerKg) + Math.max(0, econ.packagingRubPerKg)
  const variableRubPerMonth = monthlyKg * variablePerKg

  const fixedRubPerMonth =
    Math.max(0, econ.electricityRubPerMonth) +
    Math.max(0, econ.rentRubPerMonth) +
    Math.max(0, econ.payrollRubPerMonth) +
    Math.max(0, econ.logisticsRubPerMonth) +
    Math.max(0, econ.otherRubPerMonth)

  const profitRubPerMonth = revenueRubPerMonth - variableRubPerMonth - fixedRubPerMonth
  const profitRubPerYear = profitRubPerMonth * 12

  const unitProfitRubPerKg = monthlyKg > 0 ? profitRubPerMonth / monthlyKg : 0

  const capex = Math.max(0, econ.capexRub)
  const paybackMonths = capex > 0 && profitRubPerMonth > 0 ? capex / profitRubPerMonth : null

  return {
    revenueRubPerMonth,
    revenueRubPerYear,
    variableRubPerMonth,
    fixedRubPerMonth,
    profitRubPerMonth,
    profitRubPerYear,
    unitProfitRubPerKg,
    paybackMonths,
  }
}

