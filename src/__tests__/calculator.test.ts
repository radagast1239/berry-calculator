import { describe, expect, it } from 'vitest'
import { calcBerryEconomics, calcBerryEconomicsAllScenarios, totalCapexRub, DEFAULT_BERRY_ECON } from '../berryEcon'
import { calculateCrop, sumFarmKgForScenario, buildDnMonthlyCalendar, buildSdMonthlyCalendar, getPackout, getEffectiveDnWaveShares, buildDnCycleWaveProfile } from '../calculatorEngine'
import { AGRONOMIST_PURONEN_PRESET } from '../agronomistPresets'
import { mergeToCalculatorState, DEFAULT_FARM, DEFAULT_SORT_PARAMS } from '../sortTypes'
import { encodeSortsToUrl, decodeSortsFromUrl } from '../sortUrlCodec'
import { computeSortInsights } from '../sortInsights'

describe('calculateCrop', () => {
  it('computes positive market yield for default SD', () => {
    const state = mergeToCalculatorState(DEFAULT_FARM, DEFAULT_SORT_PARAMS)
    const result = calculateCrop(state, 'SD')
    expect(result.avg.marketM2PerYear).toBeGreaterThan(0)
    expect(result.min.marketM2PerYear).toBeLessThanOrEqual(result.avg.marketM2PerYear)
    expect(result.avg.marketM2PerYear).toBeLessThanOrEqual(result.max.marketM2PerYear)
  })
})

describe('berryEcon', () => {
  it('calculates profit with CAPEX breakdown', () => {
    const econ = {
      ...DEFAULT_BERRY_ECON,
      capexEquipmentRub: 1_000_000,
      capexInstallRub: 200_000,
      salePriceRubPerKg: 800,
      variableCostRubPerKg: 100,
    }
    expect(totalCapexRub(econ)).toBe(1_200_000)
    const result = calcBerryEconomics(econ, { monthlyKg: 100, annualKg: 1200 }, 10)
    expect(result.revenueRubPerYear).toBe(960_000)
    expect(result.netProfitRubPerYear).toBeGreaterThan(0)
    expect(result.roiPct).not.toBeNull()
    expect(result.npvRub).not.toBeNull()
    expect(result.revenueRubPerM2Year).toBeGreaterThan(0)
  })

  it('returns three scenarios', () => {
    const all = calcBerryEconomicsAllScenarios(DEFAULT_BERRY_ECON, {
      farmAreaM2: 5,
      scenarios: {
        min: { monthlyKg: 50, annualKg: 600 },
        avg: { monthlyKg: 100, annualKg: 1200 },
        max: { monthlyKg: 150, annualKg: 1800 },
      },
    })
    expect(all.min.netProfitRubPerYear).toBeLessThan(all.avg.netProfitRubPerYear)
    expect(all.avg.netProfitRubPerYear).toBeLessThan(all.max.netProfitRubPerYear)
  })
})

describe('sortUrlCodec', () => {
  it('roundtrips sorts collection', () => {
    const collection = {
      version: 1,
      activeSortId: 's1',
      farm: DEFAULT_FARM,
      sorts: [{ id: 's1', name: 'Тест', notes: 'заметка', params: DEFAULT_SORT_PARAMS }],
    }
    const encoded = encodeSortsToUrl(collection)
    expect(encoded).toBeTruthy()
    const decoded = decodeSortsFromUrl(encoded!)
    expect(decoded?.sorts[0].name).toBe('Тест')
    expect(decoded?.sorts[0].notes).toBe('заметка')
  })
})

describe('sortInsights', () => {
  it('picks best SD sort', () => {
    const state = mergeToCalculatorState(DEFAULT_FARM, DEFAULT_SORT_PARAMS)
    const highParams = {
      ...DEFAULT_SORT_PARAMS,
      sdYieldPerPlant: { min: 1, avg: 1.2, max: 1.4 },
    }
    const rows = [
      { sort: { id: 'a', name: 'A', notes: '', params: DEFAULT_SORT_PARAMS }, sd: calculateCrop(state, 'SD'), dn: calculateCrop(state, 'DN') },
      {
        sort: { id: 'b', name: 'B', notes: '', params: highParams },
        sd: calculateCrop(mergeToCalculatorState(DEFAULT_FARM, highParams), 'SD'),
        dn: calculateCrop(mergeToCalculatorState(DEFAULT_FARM, highParams), 'DN'),
      },
    ]
    const insights = computeSortInsights(rows, 'SD')
    expect(insights.bestSd?.id).toBe('b')
  })
})

describe('buildDnCycleWaveProfile', () => {
  it('spreads harvest across the fruiting cycle (waves inside 6–9 mo, not only after establishment)', () => {
    const state = mergeToCalculatorState(
      { ...DEFAULT_FARM, cropType: 'DN', density: 20 },
      { ...DEFAULT_SORT_PARAMS, ...AGRONOMIST_PURONEN_PRESET },
    )
    const profile = buildDnCycleWaveProfile(state, 'avg')
    const earlyHarvest = profile.filter((point) => point.month < 2).reduce((sum, point) => sum + point.marketKgPerMonth, 0)
    expect(earlyHarvest).toBeGreaterThan(0)

    const maxKg = Math.max(...profile.map((point) => point.marketKgPerMonth))
    const peakByMonth = new Map<number, number>()
    profile.forEach((point) => {
      const month = Math.floor(point.month)
      peakByMonth.set(month, Math.max(peakByMonth.get(month) ?? 0, point.marketKgPerMonth))
    })
    const activeMonths = [...peakByMonth.values()].filter((value) => value > maxKg * 0.08).length
    expect(activeMonths).toBeGreaterThanOrEqual(5)

    const step = Math.max(0.1, state.dnCycleMonths.avg / 40)
    const total = profile.reduce((sum, point) => sum + point.marketKgPerMonth * step, 0)
    const cycleMarket =
      state.dnYieldPerPlant.avg *
      state.density *
      state.kLosses *
      state.kPests *
      getPackout(state, 'avg')
    expect(total).toBeCloseTo(cycleMarket, 0)
  })
})

describe('buildDnMonthlyCalendar', () => {
  it('spreads NSD across many months with staggered cohorts', () => {
    const state = mergeToCalculatorState(
      { ...DEFAULT_FARM, cropType: 'DN', density: 20, farmAreaM2: 200 },
      {
        ...DEFAULT_SORT_PARAMS,
        ...AGRONOMIST_PURONEN_PRESET,
      },
    )
    const cal = buildDnMonthlyCalendar(state, 'avg')
    const activeMonths = cal.filter((value) => value > 0.01).length
    expect(activeMonths).toBeGreaterThanOrEqual(6)
    const annual = calculateCrop(state, 'DN').avg.marketShelfM2PerYear
    expect(cal.reduce((sum, value) => sum + value, 0)).toBeCloseTo(annual, 1)
    const min = Math.min(...cal)
    const max = Math.max(...cal)
    expect(max / min).toBeGreaterThan(1.3)
  })

  it('shows wave peaks with default turnaround under 1 month', () => {
    const state = mergeToCalculatorState({ ...DEFAULT_FARM, cropType: 'DN' }, DEFAULT_SORT_PARAMS)
    const cal = buildDnMonthlyCalendar(state, 'avg')
    const annual = calculateCrop(state, 'DN').avg.marketShelfM2PerYear
    expect(cal.reduce((sum, value) => sum + value, 0)).toBeCloseTo(annual, 1)
    const min = Math.min(...cal.filter((value) => value > 0))
    const max = Math.max(...cal)
    expect(max / min).toBeGreaterThan(1.35)
    expect(cal.every((value) => value > 0.01)).toBe(true)
  })

  it('keeps harvest in every month for agronomist preset', () => {
    const state = mergeToCalculatorState(
      { ...DEFAULT_FARM, cropType: 'DN', density: 20, farmAreaM2: 200 },
      { ...DEFAULT_SORT_PARAMS, ...AGRONOMIST_PURONEN_PRESET },
    )
    const cal = buildDnMonthlyCalendar(state, 'avg')
    expect(cal.every((value) => value > 0.01)).toBe(true)
    const min = Math.min(...cal)
    const max = Math.max(...cal)
    expect(max / min).toBeGreaterThan(1.2)
  })
})

describe('buildSdMonthlyCalendar', () => {
  it('varies SD months with weekly fruiting profile', () => {
    const state = mergeToCalculatorState(
      { ...DEFAULT_FARM, cropType: 'SD', density: 20 },
      {
        ...DEFAULT_SORT_PARAMS,
        sdCycleMonths: { min: 4, avg: 4, max: 4 },
        sdFruitingWeeks: 6,
        sdWeeklyShares: [0.1, 0.1, 0.2, 0.35, 0.2, 0.05],
      },
    )
    const cal = buildSdMonthlyCalendar(state, 'avg')
    const annual = calculateCrop(state, 'SD').avg.marketShelfM2PerYear
    expect(cal.reduce((sum, value) => sum + value, 0)).toBeCloseTo(annual, 1)
    const min = Math.min(...cal.filter((v) => v > 0))
    const max = Math.max(...cal)
    expect(max / min).toBeGreaterThan(1.05)
  })
})

describe('getPackout', () => {
  it('uses per-scenario packout triple', () => {
    const state = mergeToCalculatorState(
      { ...DEFAULT_FARM, packout: { min: 0.6, avg: 0.8, max: 0.9 } },
      DEFAULT_SORT_PARAMS,
    )
    expect(getPackout(state, 'min')).toBe(0.6)
    expect(getPackout(state, 'avg')).toBe(0.8)
    expect(getPackout(state, 'max')).toBe(0.9)
    const sd = calculateCrop(state, 'SD')
    expect(sd.min.marketM2PerYear).toBeLessThan(sd.max.marketM2PerYear)
  })
})

describe('dnSeedlingMaterial', () => {
  it('sets different first-wave share for tray vs frigo', () => {
    const frigo = mergeToCalculatorState(
      { ...DEFAULT_FARM, cropType: 'DN' },
      { ...DEFAULT_SORT_PARAMS, ...AGRONOMIST_PURONEN_PRESET, dnSeedlingMaterial: 'frigo' },
    )
    const tray = mergeToCalculatorState(
      { ...DEFAULT_FARM, cropType: 'DN' },
      { ...DEFAULT_SORT_PARAMS, ...AGRONOMIST_PURONEN_PRESET, dnSeedlingMaterial: 'tray' },
    )
    const frigoShares = getEffectiveDnWaveShares(frigo, 'avg')
    const trayShares = getEffectiveDnWaveShares(tray, 'avg')
    expect(trayShares[0]).toBeGreaterThan(frigoShares[0])
  })
})

describe('sumFarmKgForScenario', () => {
  it('sums SD and DN in both mode', () => {
    const state = mergeToCalculatorState({ ...DEFAULT_FARM, cropType: 'both' }, DEFAULT_SORT_PARAMS)
    const sd = calculateCrop(state, 'SD').avg
    const dn = calculateCrop(state, 'DN').avg
    const sum = sumFarmKgForScenario('both', sd, dn)
    expect(sum.annualKg).toBeCloseTo(sd.farmMarketAnnualKg + dn.farmMarketAnnualKg, 5)
  })
})
