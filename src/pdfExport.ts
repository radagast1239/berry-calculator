import type { CropType, Scenario } from './types'
import { parseProfileChartSpec, renderProfileLineChartCanvas } from './pdfProfileChart'

const PDF_SCENARIOS: Scenario[] = ['min', 'avg', 'max']
const PDF_SCENARIO_LABELS: Record<Scenario, string> = {
  min: 'Мин',
  avg: 'Средний',
  max: 'Макс',
}

type Html2CanvasFn = typeof import('html2canvas')['default']
type JsPdfCtor = typeof import('jspdf')['jsPDF']
type JsPdfDoc = InstanceType<JsPdfCtor>

async function loadPdfLibs(): Promise<{ html2canvas: Html2CanvasFn; jsPDF: JsPdfCtor }> {
  const [html2canvasModule, jspdfModule] = await Promise.all([import('html2canvas'), import('jspdf')])
  return { html2canvas: html2canvasModule.default, jsPDF: jspdfModule.jsPDF }
}

const PDF_W_PX = 794
const PDF_SCALE = 2
const PDF_MARGIN_MM = 12
/** Меняйте при правках вёрстки PDF — видно в подвале файла. */
export const PDF_LAYOUT_VERSION = 11

export type PdfSectionGroup = 'general' | 'results' | 'charts'

export interface PdfSectionDef {
  id: string
  label: string
  description: string
  group: PdfSectionGroup
  selector?: string
  kind?: 'cover'
  crop?: 'SD' | 'DN'
  advanced?: boolean
  /** В PDF — отдельный снимок для Мин, Средний и Макс. */
  scenarioCapture?: boolean
}

export const PDF_SECTIONS: PdfSectionDef[] = [
  {
    id: 'cover',
    label: 'Титульная страница',
    description: 'Название, дата, ключевые параметры и итоговый урожай КСД/НСД.',
    group: 'general',
    kind: 'cover',
  },
  {
    id: 'inputs',
    label: 'Параметры Мин/Средн/Макс',
    description: 'Таблица всех сценарных диапазонов: выход с куста, циклы, волны, товарность.',
    group: 'general',
    selector: '#pdf-sec-inputs',
  },
  {
    id: 'methods',
    label: 'Как читать расчёт',
    description: 'Формулы модели и пример на ваших цифрах (средний сценарий).',
    group: 'general',
    selector: '#pdf-sec-methods',
  },
  {
    id: 'model-limits',
    label: 'Ограничения и риски модели',
    description: 'Деловые формулировки ограничений: волны, рассада, товарность, календарь.',
    group: 'general',
    selector: '#pdf-sec-model-limits',
  },
  {
    id: 'results-sd',
    label: 'Результаты КСД',
    description: 'Карточки Мин/Средний/Макс и таблица по сценариям для КСД.',
    group: 'results',
    selector: '#pdf-sec-results-sd',
    crop: 'SD',
  },
  {
    id: 'results-dn',
    label: 'Результаты НСД',
    description: 'То же для НСД: циклы, товарный урожай, продуктивный месяц.',
    group: 'results',
    selector: '#pdf-sec-results-dn',
    crop: 'DN',
  },
  {
    id: 'chart-compare',
    label: 'Сравнение КСД и НСД',
    description: 'Столбцы товарного урожая по сценариям Мин / Средний / Макс.',
    group: 'charts',
    selector: '#pdf-sec-chart-compare',
  },
  {
    id: 'chart-farm-monthly',
    label: 'Помесячный сбор с фермы',
    description: 'Кг товарной ягоды по месяцам: КСД по недельному профилю, НСД по волнам.',
    group: 'charts',
    selector: '#pdf-sec-chart-farm-monthly',
    scenarioCapture: true,
  },
  {
    id: 'chart-sensitivity',
    label: 'Чувствительность',
    description: 'Как меняется урожай при ±% к плотности и выходу с куста.',
    group: 'charts',
    selector: '#pdf-sec-chart-sensitivity',
    advanced: true,
  },
  {
    id: 'chart-uncertainty',
    label: 'Диапазон 10/50/90%',
    description: 'Статистический разброс (Монте-Карло) внутри ваших Мин–Макс.',
    group: 'charts',
    selector: '#pdf-sec-chart-uncertainty',
    advanced: true,
  },
  {
    id: 'chart-sd-profile',
    label: 'Профиль цикла КСД',
    description: 'Недельное плодоношение в конце цикла (10-10-20-35-20-5%).',
    group: 'charts',
    selector: '#pdf-sec-chart-sd-profile',
    crop: 'SD',
    advanced: true,
    scenarioCapture: true,
  },
  {
    id: 'chart-dn-calendar',
    label: 'Календарь НСД по волнам',
    description: 'Распределение урожая НСД по месяцам календарного года.',
    group: 'charts',
    selector: '#pdf-sec-chart-dn-calendar',
    crop: 'DN',
    advanced: true,
    scenarioCapture: true,
  },
  {
    id: 'chart-dn-profile',
    label: 'Профиль волны НСД',
    description: 'Форма сбора внутри цикла: пики волн или ручной профиль.',
    group: 'charts',
    selector: '#pdf-sec-chart-dn-profile',
    crop: 'DN',
    advanced: true,
    scenarioCapture: true,
  },
  {
    id: 'sorts-compare',
    label: 'Сравнение сортов',
    description: 'Таблица урожайности по всем сохранённым сортам.',
    group: 'results',
    selector: '#pdf-sec-sorts-compare',
  },
  {
    id: 'sorts-econ',
    label: 'Экономика по сортам',
    description: 'Выручка, EBITDA и прибыль по сортам.',
    group: 'results',
    selector: '#pdf-sec-sorts-econ',
  },
  {
    id: 'econ',
    label: 'Экономика ягоды',
    description: 'CAPEX, OPEX, прибыль, окупаемость при заполненных ценах.',
    group: 'results',
    selector: '#pdf-sec-econ',
  },
]

export const PDF_GROUP_LABELS: Record<PdfSectionGroup, string> = {
  general: 'Общее',
  results: 'Результаты',
  charts: 'Графики',
}

export const PDF_PRESETS = {
  scenarios: [
    'cover',
    'inputs',
    'results-sd',
    'results-dn',
    'chart-compare',
    'chart-farm-monthly',
    'chart-sd-profile',
    'chart-dn-calendar',
    'chart-dn-profile',
    'chart-uncertainty',
  ],
  client: ['cover', 'methods', 'model-limits', 'results-sd', 'results-dn', 'chart-compare', 'chart-farm-monthly'],
  brief: ['cover', 'methods', 'model-limits', 'results-sd', 'results-dn', 'chart-compare', 'chart-farm-monthly'],
  investor: [
    'cover',
    'methods',
    'model-limits',
    'sorts-compare',
    'sorts-econ',
    'results-sd',
    'results-dn',
    'econ',
    'chart-compare',
    'chart-sensitivity',
  ],
  full: PDF_SECTIONS.map((s) => s.id),
}

export const PDF_PRESET_HINTS: Record<keyof typeof PDF_PRESETS, string> = {
  scenarios: 'Все Мин/Средн/Макс: параметры, таблицы результатов и графики по каждому сценарию.',
  brief: 'Титул, формулы, результаты и два главных графика.',
  client: 'Как «Краткий» — без сложной аналитики.',
  investor: 'Сорта, экономика, чувствительность — для обсуждения проекта.',
  full: 'Все разделы, включая волны НСД и неопределённость.',
}

/** Пауза перед захватом DOM в PDF (дать графикам отрисоваться). */
export function waitForPdfPaint(ms = 120): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(resolve, ms)
      })
    })
  })
}

export interface PdfExportMeta {
  title: string
  subtitle: string
  date: string
  lines: { label: string; value: string }[]
}

export interface PdfExportHooks {
  onBeforeSectionCapture?: (sectionId: string, scenario?: Scenario) => Promise<void>
}

function cropVisible(cropType: CropType, crop?: 'SD' | 'DN'): boolean {
  if (!crop) return true
  if (cropType === 'both') return true
  return cropType === crop
}

export function getAvailablePdfSections(cropType: CropType, _clientMode: boolean): PdfSectionDef[] {
  return PDF_SECTIONS.filter((sec) => {
    if (!cropVisible(cropType, sec.crop)) return false
    if (sec.selector && !document.querySelector(sec.selector)) return false
    return true
  })
}

export function defaultPdfSelection(cropType: CropType, clientMode: boolean): string[] {
  const available = new Set(getAvailablePdfSections(cropType, clientMode).map((s) => s.id))
  const preset = clientMode ? PDF_PRESETS.client : PDF_PRESETS.scenarios
  return preset.filter((id) => available.has(id))
}

function sortSectionIds(ids: string[]): string[] {
  const order = new Map(PDF_SECTIONS.map((s, i) => [s.id, i]))
  return ids.slice().sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
}

function waitForPaint(ms = 120): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(resolve, ms)
      })
    })
  })
}

function measureChartWrap(wrap: HTMLElement): { width: number; height: number } {
  const rect = wrap.getBoundingClientRect()
  const tall = wrap.classList.contains('chart-wrap-tall')
  return {
    width: Math.max(Math.round(rect.width), wrap.clientWidth, 320),
    height: Math.max(Math.round(rect.height), wrap.clientHeight, tall ? 340 : 300),
  }
}

async function svgToCanvas(svg: SVGElement, width: number, height: number): Promise<HTMLCanvasElement | null> {
  const clone = svg.cloneNode(true) as SVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.querySelectorAll('[clip-path]').forEach((el) => el.removeAttribute('clip-path'))
  clone.querySelectorAll('clipPath').forEach((el) => el.remove())
  const viewBox = svg.getAttribute('viewBox')
  if (viewBox) clone.setAttribute('viewBox', viewBox)
  clone.setAttribute('width', String(Math.round(width)))
  clone.setAttribute('height', String(Math.round(height)))
  clone.style.overflow = 'visible'
  const serialized = new XMLSerializer().serializeToString(clone)
  const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('SVG render failed'))
      image.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * PDF_SCALE)
    canvas.height = Math.round(height * PDF_SCALE)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.scale(PDF_SCALE, PDF_SCALE)
    ctx.drawImage(img, 0, 0, width, height)
    return canvas
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Recharts SVG → PNG: html2canvas обрезает линии, снимаем график с живого SVG. */
async function rasterizeChartWrapsFromLive(source: HTMLElement, clone: HTMLElement) {
  const srcWraps = source.querySelectorAll('.chart-wrap')
  const dstWraps = clone.querySelectorAll('.chart-wrap')

  for (let index = 0; index < srcWraps.length; index += 1) {
    const srcWrap = srcWraps[index]
    const dstWrap = dstWraps[index]
    if (!(srcWrap instanceof HTMLElement) || !(dstWrap instanceof HTMLElement)) continue

    const { width, height } = measureChartWrap(srcWrap)

    const profileSpec = parseProfileChartSpec(srcWrap, width, height)
    const canvas = profileSpec
      ? renderProfileLineChartCanvas(profileSpec)
      : await (async () => {
          const svg = srcWrap.querySelector('svg.recharts-surface')
          if (!(svg instanceof SVGSVGElement)) return null
          return svgToCanvas(svg, width, height)
        })()
    if (!canvas) continue

    const img = document.createElement('img')
    img.alt = ''
    img.src = canvas.toDataURL('image/png')
    img.style.display = 'block'
    img.style.width = '100%'
    img.style.height = `${height}px`
    img.style.maxWidth = '100%'

    dstWrap.innerHTML = ''
    dstWrap.style.width = '100%'
    dstWrap.style.height = `${height}px`
    dstWrap.style.minHeight = `${height}px`
    dstWrap.style.overflow = 'visible'
    dstWrap.appendChild(img)
  }
}

function suppressLiveUiForPdf(): () => void {
  document.body.classList.add('pdf-exporting')
  const hidden: Array<{ el: HTMLElement; display: string }> = []
  document.querySelectorAll('.app, .sticky-summary, .toast, .wizard-backdrop, .modal-backdrop').forEach((node) => {
    if (!(node instanceof HTMLElement)) return
    hidden.push({ el: node, display: node.style.display })
    node.style.display = 'none'
  })
  return () => {
    document.body.classList.remove('pdf-exporting')
    hidden.forEach(({ el, display }) => {
      el.style.display = display
    })
  }
}

const PDF_TABLE_HEADERS = [
  'Сцен.',
  'Цикл/год',
  'Валовый кг/м²',
  'Био кг/м²',
  'Товар кг/м²',
  'Ферма, кг',
]

/** Минимальная подготовка клона: скрыть лишнее, не менять размеры графиков. */
function prepareCloneForPdf(root: HTMLElement) {
  root.querySelectorAll('.toggle button, .no-print, .no-print-panel').forEach((el) => {
    ;(el as HTMLElement).style.display = 'none'
  })
  root.querySelectorAll('input[type="range"]').forEach((el) => {
    ;(el as HTMLElement).style.display = 'none'
  })
  root.querySelectorAll('.no-print-table').forEach((el) => {
    el.classList.remove('no-print-table')
  })
  root.querySelectorAll('.recharts-legend-wrapper').forEach((el) => {
    el.remove()
  })
  root.querySelectorAll('.chart-wrap').forEach((el) => {
    const node = el as HTMLElement
    node.style.overflow = 'visible'
  })
  compactResultsTables(root)
}

function compactResultsTables(root: HTMLElement) {
  root.querySelectorAll('.table-wrap table').forEach((table) => {
    table.classList.add('pdf-results-table')
    table.querySelectorAll('thead th').forEach((th, index) => {
      if (PDF_TABLE_HEADERS[index]) th.textContent = PDF_TABLE_HEADERS[index]
    })
    table.querySelectorAll('tbody td').forEach((td) => {
      const text = td.textContent?.trim()
      if (text?.includes('·')) {
        td.innerHTML = text.replace(/\s*·\s*/g, '<br/>')
      }
    })
  })
}

async function cloneSectionForPdf(source: HTMLElement): Promise<HTMLElement> {
  const clone = source.cloneNode(true) as HTMLElement
  clone.style.display = 'block'
  clone.style.visibility = 'visible'
  clone.style.opacity = '1'
  await rasterizeChartWrapsFromLive(source, clone)
  prepareCloneForPdf(clone)
  return clone
}

function addScenarioBadge(block: HTMLElement, scenario: Scenario) {
  const h3 = block.querySelector('h3')
  if (!h3) return
  const badge = document.createElement('span')
  badge.className = 'pdf-scenario-badge'
  badge.textContent = ` · ${PDF_SCENARIO_LABELS[scenario]}`
  h3.appendChild(badge)
}

function buildCover(meta: PdfExportMeta): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'pdf-page-block pdf-cover-block'
  wrap.innerHTML = `
    <p class="pdf-cover-brand">Daogreen</p>
    <h1 class="pdf-cover-title">${escapeHtml(meta.title)}</h1>
    <p class="pdf-cover-sub">${escapeHtml(meta.subtitle)}</p>
    <p class="pdf-cover-date">${escapeHtml(meta.date)}</p>
    <div class="pdf-cover-metrics">
      ${meta.lines
        .map(
          (line) =>
            `<div class="pdf-cover-metric"><span class="pdf-cover-m-l">${escapeHtml(line.label)}</span><span class="pdf-cover-m-v">${escapeHtml(line.value)}</span></div>`,
        )
        .join('')}
    </div>
    <p class="pdf-cover-note">Модель даёт ориентиры и диапазон неопределённости, но не заменяет пилотный прогон.</p>
  `
  return wrap
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function appendCanvasToPdf(
  pdf: JsPdfDoc,
  canvas: HTMLCanvasElement,
  margin: number,
  contentW: number,
  pageRef: { started: boolean; cursorY: number },
  options: { atomic?: boolean; gapAfter?: number; minSpaceBefore?: number } = {},
) {
  const pageH = pdf.internal.pageSize.getHeight()
  const contentTop = margin + 10
  const footerReserve = margin + 6
  const usableH = pageH - contentTop - footerReserve
  const pxPerMm = canvas.width / contentW
  const imgHmm = canvas.height / pxPerMm

  const ensureSpace = (neededHmm: number) => {
    const spaceLeft = pageRef.started ? pageH - footerReserve - pageRef.cursorY : usableH
    if (!pageRef.started || spaceLeft < neededHmm) {
      if (pageRef.started) pdf.addPage()
      pageRef.started = true
      pageRef.cursorY = contentTop
    }
  }

  if (options.minSpaceBefore && pageRef.started) {
    const spaceLeft = pageH - footerReserve - pageRef.cursorY
    if (spaceLeft < options.minSpaceBefore) {
      pdf.addPage()
      pageRef.cursorY = contentTop
    }
  }

  if (options.atomic) {
    let drawW = contentW
    let drawH = imgHmm
    if (drawH > usableH) {
      const scale = usableH / drawH
      drawH = usableH
      drawW = contentW * scale
    }
    ensureSpace(drawH)
    const x = margin + (contentW - drawW) / 2
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, pageRef.cursorY, drawW, drawH)
    pageRef.cursorY += drawH + (options.gapAfter ?? 6)
    return
  }

  const slicePx = Math.max(1, Math.floor(usableH * pxPerMm))
  let offsetY = 0

  while (offsetY < canvas.height) {
    const sliceH = Math.min(slicePx, canvas.height - offsetY)
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = sliceH
    const ctx = slice.getContext('2d')
    if (!ctx) break
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, slice.width, slice.height)
    ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
    const sliceHmm = sliceH / pxPerMm

    ensureSpace(sliceHmm)
    pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, pageRef.cursorY, contentW, sliceHmm)
    pageRef.cursorY += sliceHmm + 2
    offsetY += sliceH
  }
  pageRef.cursorY += options.gapAfter ?? 4
}

/** Захват блока как на экране: один html2canvas, без iframe и без разрезания графика. */
async function captureStagingBlock(
  html2canvas: Html2CanvasFn,
  block: HTMLElement,
): Promise<HTMLCanvasElement | null> {
  const restoreLiveUi = suppressLiveUiForPdf()
  const staging = document.createElement('div')
  staging.className = 'pdf-staging'
  staging.dataset.pdfCapture = '1'
  staging.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    `width:${PDF_W_PX}px`,
    'max-width:none',
    'z-index:2147483646',
    'background:#ffffff',
    'padding:12px',
    'box-sizing:border-box',
    'pointer-events:none',
  ].join(';')

  const wrap = document.createElement('div')
  wrap.className = 'pdf-export-wrap pdf-page-block'
  wrap.appendChild(block)
  staging.appendChild(wrap)
  document.body.appendChild(staging)

  const paintMs = block.querySelector('.chart-wrap') ? 650 : 280
  await waitForPaint(paintMs)

  try {
    const canvas = await html2canvas(staging, {
      scale: PDF_SCALE,
      backgroundColor: '#ffffff',
      useCORS: true,
      allowTaint: true,
      logging: false,
      width: PDF_W_PX,
      windowWidth: PDF_W_PX,
      scrollX: 0,
      scrollY: 0,
      foreignObjectRendering: false,
      imageTimeout: 15000,
    })
    if (!canvas || canvas.width < 2 || canvas.height < 2) return null
    return canvas
  } catch {
    return null
  } finally {
    staging.remove()
    restoreLiveUi()
  }
}

export async function exportSectionsToPdf(
  selectedIds: string[],
  meta: PdfExportMeta,
  hooks?: PdfExportHooks,
): Promise<void> {
  const { html2canvas, jsPDF } = await loadPdfLibs()
  const ordered = sortSectionIds(selectedIds)
  if (!ordered.length) throw new Error('Выберите хотя бы один раздел.')

  const secMap = new Map(PDF_SECTIONS.map((s) => [s.id, s]))
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  const margin = PDF_MARGIN_MM
  const contentW = pdf.internal.pageSize.getWidth() - margin * 2
  const pageRef = { started: false, cursorY: 0 }
  let hasContent = false

  const scrollY = window.scrollY
  window.scrollTo(0, 0)
  try {
    for (const id of ordered) {
      const sec = secMap.get(id)
      if (!sec) continue

      if (sec.kind === 'cover') {
        await hooks?.onBeforeSectionCapture?.(id)
        const canvas = await captureStagingBlock(html2canvas, buildCover(meta))
        if (!canvas) continue
        appendCanvasToPdf(pdf, canvas, margin, contentW, pageRef, { atomic: true, gapAfter: 8 })
        hasContent = true
        continue
      }

      if (!sec.selector) continue
      const liveSection = document.querySelector(sec.selector)
      if (!(liveSection instanceof HTMLElement)) continue

      const scenarios = sec.scenarioCapture ? PDF_SCENARIOS : [undefined]
      for (const scenario of scenarios) {
        await hooks?.onBeforeSectionCapture?.(id, scenario)

        liveSection.scrollIntoView({ block: 'center' })
        const isProfileChart =
          sec.id === 'chart-sd-profile' || sec.id === 'chart-dn-profile'
        await waitForPaint(
          scenario && isProfileChart ? 800 : scenario ? 650 : isProfileChart ? 750 : sec.group === 'charts' ? 550 : 280,
        )

        const block = await cloneSectionForPdf(liveSection)
        if (scenario) addScenarioBadge(block, scenario)
        const canvas = await captureStagingBlock(html2canvas, block)
        if (!canvas) continue

        const hasChart = Boolean(liveSection.querySelector('.chart-wrap'))
        appendCanvasToPdf(pdf, canvas, margin, contentW, pageRef, {
          atomic: hasChart,
          gapAfter: 10,
        })
        hasContent = true
      }
    }
  } finally {
    window.scrollTo(0, scrollY)
  }

  if (!hasContent) throw new Error('Не удалось собрать PDF: выбранные разделы не найдены на странице.')

  const pageCount = pdf.getNumberOfPages()
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page)
    pdf.setFontSize(8)
    pdf.setTextColor(130)
    pdf.text(`Daogreen · berry-calculator · v${PDF_LAYOUT_VERSION} · ${page}/${pageCount}`, pageW / 2, pageH - 5, {
      align: 'center',
    })
  }

  const datePart = meta.date.replace(/\./g, '-')
  pdf.save(`berry-calculator-${datePart}.pdf`)
}
