export type CropType = 'SD' | 'DN' | 'both'
export type AreaBasis = 'shelf' | 'floor'
export type Scenario = 'min' | 'avg' | 'max'
export type Triple = Record<Scenario, number>

export const AREA_BASIS_BUTTON_LABELS: Record<AreaBasis, string> = {
  shelf: 'База: полезная посевная площадь, м²',
  floor: 'База: площадь по полу',
}

export const AREA_BASIS_SHORT: Record<AreaBasis, string> = {
  shelf: 'полезная посевная площадь',
  floor: 'площадь по полу',
}

export const AREA_BASIS_GENITIVE: Record<AreaBasis, string> = {
  shelf: 'полезной посевной площади',
  floor: 'площади по полу',
}
