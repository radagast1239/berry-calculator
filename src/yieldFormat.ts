export function fmtNum(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}

export function yearlyToMonthly(yearly: number): number {
  return yearly / 12
}

/** Значение: «3.3 · 40.0» — подпись «кг/м²·мес · кг/м²/год». */
export function fmtSqmMoYear(monthly: number, yearly: number, digitsMo = 1, digitsYear = 1): string {
  return `${fmtNum(monthly, digitsMo)} · ${fmtNum(yearly, digitsYear)}`
}

/** Значение: «3 · 40» — подпись «кг/мес · кг/год». */
export function fmtFarmMoYear(monthlyKg: number, yearlyKg: number, digitsMo = 0, digitsYear = 0): string {
  return `${fmtNum(monthlyKg, digitsMo)} · ${fmtNum(yearlyKg, digitsYear)}`
}

export const YIELD_COL = {
  sqm: 'кг/м²·мес · кг/м²/год',
  farm: 'кг/мес · кг/год',
} as const
