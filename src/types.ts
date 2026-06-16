export type CropType = 'SD' | 'DN' | 'both'
// База расчёта в этом проекте фиксирована: полезная посевная площадь (м²).
// Старые ссылки с areaBasis/floor поддерживаем на уровне парсинга URL.
export type AreaBasis = 'shelf'
export type Scenario = 'min' | 'avg' | 'max'
export type Triple = Record<Scenario, number>
