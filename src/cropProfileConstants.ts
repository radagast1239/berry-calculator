/** Недель в месяце (для перевода недель плодоношения КСД). */
export const WEEKS_PER_MONTH = 4.345

/** Распределение урожая КСД по 6 неделям плодоношения (Пуронен). */
export const DEFAULT_SD_WEEKLY_SHARES = [0.1, 0.1, 0.2, 0.35, 0.2, 0.05] as const

export const DEFAULT_SD_FRUITING_WEEKS = 6

/** Доля урожая цикла НСД, приходящаяся на 1-ю волну при типе рассады. */
export const DN_FIRST_WAVE_TOTAL_SHARE = {
  frigo: 0.125,
  tray: 0.275,
} as const

export type DnSeedlingMaterial = 'manual' | 'frigo' | 'tray'

export function normalizeWeeklyShares(shares: number[], weeks = DEFAULT_SD_FRUITING_WEEKS): number[] {
  const slice = shares.slice(0, weeks)
  while (slice.length < weeks) slice.push(DEFAULT_SD_WEEKLY_SHARES[slice.length] ?? 0)
  const sum = slice.reduce((acc, value) => acc + Math.max(0, value), 0)
  if (sum <= 0) return [...DEFAULT_SD_WEEKLY_SHARES]
  return slice.map((value) => Math.max(0, value) / sum)
}
