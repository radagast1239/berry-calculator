import type { CalculatorState } from './calculatorTypes'
import {
  createSortProfile,
  DEFAULT_FARM,
  DEFAULT_SORT_PARAMS,
  extractFarmSettings,
  extractSortParams,
  mergeToCalculatorState,
  MAX_SORTS,
  type SortParams,
  type SortProfile,
  type SortsCollection,
} from './sortTypes'
import { decodeSortsFromUrl } from './sortUrlCodec'

const STORAGE_KEY = 'berrySortsV1'

function defaultCollection(): SortsCollection {
  const sorts = [createSortProfile(1)]
  return {
    version: 1,
    activeSortId: sorts[0].id,
    farm: { ...DEFAULT_FARM },
    sorts,
  }
}

function normalizeSort(raw: unknown, index: number): SortProfile | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<SortProfile>
  if (!item.id || !item.name || !item.params) return null
  const p = item.params as SortParamsPartial
  return {
    id: String(item.id),
    name: String(item.name).slice(0, 40) || `Сорт ${index}`,
    notes: String(item.notes ?? '').slice(0, 500),
    params: {
      ...DEFAULT_SORT_PARAMS,
      ...p,
      sdYieldPerPlant: { ...DEFAULT_SORT_PARAMS.sdYieldPerPlant, ...p.sdYieldPerPlant },
      sdCycleMonths: { ...DEFAULT_SORT_PARAMS.sdCycleMonths, ...p.sdCycleMonths },
      dnYieldPerPlant: { ...DEFAULT_SORT_PARAMS.dnYieldPerPlant, ...p.dnYieldPerPlant },
      dnCycleMonths: { ...DEFAULT_SORT_PARAMS.dnCycleMonths, ...p.dnCycleMonths },
      dnTurnaroundMonths: { ...DEFAULT_SORT_PARAMS.dnTurnaroundMonths, ...p.dnTurnaroundMonths },
      dnWaves: { ...DEFAULT_SORT_PARAMS.dnWaves, ...p.dnWaves },
      dnEstablishMonths: { ...DEFAULT_SORT_PARAMS.dnEstablishMonths, ...p.dnEstablishMonths },
      dnWave1Share: { ...DEFAULT_SORT_PARAMS.dnWave1Share, ...p.dnWave1Share },
      dnWave2Share: { ...DEFAULT_SORT_PARAMS.dnWave2Share, ...p.dnWave2Share },
      berryMassG: { ...DEFAULT_SORT_PARAMS.berryMassG, ...p.berryMassG },
      dnManualProfileEnabled: Boolean(p.dnManualProfileEnabled),
      dnManualMonthlyPlantYield:
        Array.isArray(p.dnManualMonthlyPlantYield) && p.dnManualMonthlyPlantYield.length === 12
          ? p.dnManualMonthlyPlantYield.map((v) => Number(v) || 0)
          : [...DEFAULT_SORT_PARAMS.dnManualMonthlyPlantYield],
    },
  }
}

function normalizeCollection(raw: Partial<SortsCollection>): SortsCollection {
  const sorts = (raw.sorts ?? [])
    .map((s, i) => normalizeSort(s, i + 1))
    .filter((s): s is SortProfile => s !== null)
    .slice(0, MAX_SORTS)
  if (!sorts.length) return defaultCollection()
  const activeSortId = sorts.some((s) => s.id === raw.activeSortId) ? String(raw.activeSortId) : sorts[0].id
  const farm = { ...DEFAULT_FARM, ...(raw.farm ?? {}) }
  return { version: 1, activeSortId, farm, sorts }
}

type SortParamsPartial = Partial<SortParams> & {
  sdYieldPerPlant?: Partial<import('./types').Triple>
  sdCycleMonths?: Partial<import('./types').Triple>
  dnYieldPerPlant?: Partial<import('./types').Triple>
  dnCycleMonths?: Partial<import('./types').Triple>
  dnTurnaroundMonths?: Partial<import('./types').Triple>
  dnWaves?: Partial<import('./types').Triple>
  dnEstablishMonths?: Partial<import('./types').Triple>
  dnWave1Share?: Partial<import('./types').Triple>
  dnWave2Share?: Partial<import('./types').Triple>
  berryMassG?: Partial<import('./types').Triple>
}

export function loadSortsCollection(): SortsCollection {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultCollection()
    return normalizeCollection(JSON.parse(raw) as Partial<SortsCollection>)
  } catch {
    return defaultCollection()
  }
}

export function saveSortsCollection(collection: SortsCollection): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collection))
  } catch {
    // ignore quota errors
  }
}

export function persistFromCalculator(
  collection: SortsCollection,
  state: CalculatorState,
  activeSortId: string,
  activeNotes?: string,
): SortsCollection {
  const farm = extractFarmSettings(state)
  const params = extractSortParams(state)
  const sorts = collection.sorts.map((s) => {
    if (s.id !== activeSortId) return s
    return {
      ...s,
      params,
      notes: activeNotes !== undefined ? activeNotes.slice(0, 500) : s.notes,
    }
  })
  const next = { ...collection, farm, sorts, activeSortId }
  saveSortsCollection(next)
  return next
}

export function addSort(
  collection: SortsCollection,
  options?: { name?: string; params?: SortParams; notes?: string; copyFromId?: string },
): SortsCollection | null {
  if (collection.sorts.length >= MAX_SORTS) return null
  const index = collection.sorts.length + 1
  const source =
    (options?.copyFromId ? collection.sorts.find((s) => s.id === options.copyFromId) : null) ??
    collection.sorts.find((s) => s.id === collection.activeSortId)
  const params = options?.params ?? source?.params ?? DEFAULT_SORT_PARAMS
  const name = options?.name ?? `Сорт ${index}`
  const notes = options?.notes ?? source?.notes ?? ''
  const sorts = [...collection.sorts, createSortProfile(index, params, name, notes)]
  const next = { ...collection, sorts, activeSortId: sorts[sorts.length - 1].id }
  saveSortsCollection(next)
  return next
}

export function duplicateSort(collection: SortsCollection, sortId: string): SortsCollection | null {
  const source = collection.sorts.find((s) => s.id === sortId)
  if (!source) return null
  return addSort(collection, {
    name: `${source.name} (копия)`.slice(0, 40),
    params: JSON.parse(JSON.stringify(source.params)) as SortParams,
    notes: source.notes,
    copyFromId: sortId,
  })
}

export function removeSort(collection: SortsCollection, sortId: string): SortsCollection | null {
  if (collection.sorts.length <= 1) return null
  const sorts = collection.sorts.filter((s) => s.id !== sortId)
  const activeSortId = collection.activeSortId === sortId ? sorts[0].id : collection.activeSortId
  const next = { ...collection, sorts, activeSortId }
  saveSortsCollection(next)
  return next
}

export function renameSort(collection: SortsCollection, sortId: string, name: string): SortsCollection {
  const trimmed = name.trim().slice(0, 40) || 'Без названия'
  const sorts = collection.sorts.map((s) => (s.id === sortId ? { ...s, name: trimmed } : s))
  const next = { ...collection, sorts }
  saveSortsCollection(next)
  return next
}

export function updateSortNotes(collection: SortsCollection, sortId: string, notes: string): SortsCollection {
  const trimmed = notes.slice(0, 500)
  const sorts = collection.sorts.map((s) => (s.id === sortId ? { ...s, notes: trimmed } : s))
  const next = { ...collection, sorts }
  saveSortsCollection(next)
  return next
}

export function replaceSortsCollection(collection: SortsCollection): SortsCollection {
  const next = normalizeCollection(collection)
  saveSortsCollection(next)
  return next
}

export function initAppSortsState(urlState: CalculatorState): {
  state: CalculatorState
  collection: SortsCollection
} {
  const params = new URLSearchParams(window.location.search)
  const sortsData = params.get('sortsData')

  let collection: SortsCollection
  if (sortsData) {
    const decoded = decodeSortsFromUrl(sortsData)
    collection = decoded ? normalizeCollection(decoded) : loadSortsCollection()
    saveSortsCollection(collection)
  } else {
    collection = loadSortsCollection()
    const sortIdParam = params.get('sortId')
    const hasUrlParams = params.has('v') || params.has('density') || params.has('cropType')

    if (hasUrlParams) {
      const activeId =
        sortIdParam && collection.sorts.some((s) => s.id === sortIdParam)
          ? sortIdParam
          : collection.activeSortId
      collection = {
        ...collection,
        farm: extractFarmSettings(urlState),
        activeSortId: activeId,
        sorts: collection.sorts.map((s) =>
          s.id === activeId ? { ...s, params: extractSortParams(urlState) } : s,
        ),
      }
      saveSortsCollection(collection)
    }
  }

  const active = collection.sorts.find((s) => s.id === collection.activeSortId) ?? collection.sorts[0]
  return {
    collection,
    state: mergeToCalculatorState(collection.farm, active.params),
  }
}
