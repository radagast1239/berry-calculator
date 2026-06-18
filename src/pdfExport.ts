import type { CropType } from './types'

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
  },
  {
    id: 'chart-dn-calendar',
    label: 'Календарь НСД по волнам',
    description: 'Распределение урожая НСД по месяцам календарного года.',
    group: 'charts',
    selector: '#pdf-sec-chart-dn-calendar',
    crop: 'DN',
    advanced: true,
  },
  {
    id: 'chart-dn-profile',
    label: 'Профиль волны НСД',
    description: 'Форма сбора внутри цикла: пики волн или ручной профиль.',
    group: 'charts',
    selector: '#pdf-sec-chart-dn-profile',
    crop: 'DN',
    advanced: true,
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

function cropVisible(cropType: CropType, crop?: 'SD' | 'DN'): boolean {
  if (!crop) return true
  if (cropType === 'both') return true
  return cropType === crop
}

export function getAvailablePdfSections(cropType: CropType, clientMode: boolean): PdfSectionDef[] {
  return PDF_SECTIONS.filter((sec) => {
    if (!cropVisible(cropType, sec.crop)) return false
    if (clientMode && sec.advanced) return false
    if (sec.selector && !document.querySelector(sec.selector)) return false
    return true
  })
}

export function defaultPdfSelection(cropType: CropType, clientMode: boolean): string[] {
  const available = new Set(getAvailablePdfSections(cropType, clientMode).map((s) => s.id))
  const preset = clientMode ? PDF_PRESETS.client : PDF_PRESETS.brief
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

function copySvgFromSource(source: HTMLElement, clone: HTMLElement) {
  const srcSvgs = source.querySelectorAll('svg.recharts-surface')
  const dstSvgs = Array.from(clone.querySelectorAll('svg.recharts-surface'))
  srcSvgs.forEach((src, index) => {
    const dst = dstSvgs[index]
    if (!dst) return
    const width = src.getBoundingClientRect().width || src.clientWidth || 700
    const height = src.getBoundingClientRect().height || src.clientHeight || 280
    const fresh = src.cloneNode(true) as SVGElement
    fresh.setAttribute('width', String(Math.round(width)))
    fresh.setAttribute('height', String(Math.round(height)))
    fresh.style.width = `${Math.round(width)}px`
    fresh.style.height = `${Math.round(height)}px`
    fresh.style.display = 'block'
    fresh.style.overflow = 'visible'
    dst.replaceWith(fresh)
  })
}

/** После разбиения на части — подтянуть живой SVG с экрана (подписи месяцев, оси). */
function refreshChartSvgsFromLive(liveRoot: HTMLElement, unit: HTMLElement) {
  if (!unit.querySelector('.chart-wrap')) return
  copySvgFromSource(liveRoot, unit)
  prepareChartUnitForPdf(unit)
}

function prepareChartUnitForPdf(root: HTMLElement) {
  root.querySelectorAll('.recharts-legend-wrapper').forEach((el) => el.remove())
  root.querySelectorAll('.chart-wrap').forEach((el) => {
    const node = el as HTMLElement
    node.style.height = '280px'
    node.style.minHeight = '280px'
    node.style.marginBottom = '4px'
    node.style.overflow = 'visible'
  })
  root.querySelectorAll('.chart-legend-row').forEach((el) => {
    const node = el as HTMLElement
    node.style.display = 'flex'
    node.style.flexWrap = 'wrap'
    node.style.gap = '8px 18px'
    node.style.margin = '8px 0 12px'
    node.style.padding = '0 4px'
    node.style.fontSize = '12px'
    node.style.lineHeight = '1.4'
    node.style.color = '#374151'
  })
}

function prepareCloneForPdf(root: HTMLElement) {
  root.querySelectorAll('.toggle button, .no-print').forEach((el) => {
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
    node.style.height = '280px'
    node.style.minHeight = '280px'
    node.style.marginBottom = '4px'
    node.style.overflow = 'visible'
  })
  root.querySelectorAll('.chart-legend-row').forEach((el) => {
    const node = el as HTMLElement
    node.style.marginTop = '6px'
    node.style.marginBottom = '10px'
  })
  prepareChartUnitForPdf(root)
  root.querySelectorAll('.chart-footnote').forEach((el) => {
    const node = el as HTMLElement
    node.style.marginTop = '18px'
    node.style.paddingTop = '8px'
    node.style.lineHeight = '1.55'
    node.style.display = 'block'
  })
  root.querySelectorAll('.model-disclaimer').forEach((el) => {
    const node = el as HTMLElement
    node.style.lineHeight = '1.55'
    node.style.padding = '10px 12px'
    node.style.overflow = 'visible'
  })
  compactResultsTables(root)
}

const PDF_TABLE_HEADERS = [
  'Сцен.',
  'Цикл/год',
  'Валовый кг/м²',
  'Био кг/м²',
  'Товар кг/м²',
  'Ферма, кг',
]

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

function splitMethodsCard(block: HTMLElement): HTMLElement[] | null {
  if (!block.classList.contains('methods-card')) return null

  const units: HTMLElement[] = []
  const main = document.createElement('div')
  main.className = 'pdf-split-unit pdf-methods-main'
  block.childNodes.forEach((node) => {
    if (!(node instanceof HTMLElement)) return
    if (node.classList.contains('model-disclaimer')) return
    main.appendChild(node.cloneNode(true))
  })
  if (main.childNodes.length > 0) units.push(main)

  const disclaimer = block.querySelector(':scope > .model-disclaimer')
  if (disclaimer) {
    const wrap = document.createElement('div')
    wrap.className = 'pdf-split-unit pdf-methods-disclaimer'
    wrap.appendChild(disclaimer.cloneNode(true))
    units.push(wrap)
  }

  return units.length > 0 ? units : null
}

function splitChartCard(block: HTMLElement): HTMLElement[] | null {
  const chartWrap = block.querySelector('.chart-wrap')
  if (!chartWrap) return null

  const units: HTMLElement[] = []
  const header = document.createElement('div')
  header.className = 'pdf-split-unit pdf-chart-header'
  block.childNodes.forEach((node) => {
    if (!(node instanceof HTMLElement)) return
    if (node.classList.contains('chart-wrap')) return
    if (node.classList.contains('chart-legend-row')) return
    if (node.classList.contains('hint') || node.classList.contains('chart-footnote')) return
    header.appendChild(node.cloneNode(true))
  })
  if (header.childNodes.length > 0) units.push(header)

  const chartBody = document.createElement('div')
  chartBody.className = 'pdf-split-unit pdf-chart-only'
  chartBody.appendChild(chartWrap.cloneNode(true))
  block.querySelectorAll(':scope > .chart-legend-row').forEach((el) => {
    chartBody.appendChild(el.cloneNode(true))
  })
  units.push(chartBody)

  block.querySelectorAll(':scope > .hint, :scope > .chart-footnote').forEach((el) => {
    const wrap = document.createElement('div')
    wrap.className = 'pdf-split-unit pdf-chart-footnote'
    wrap.appendChild(el.cloneNode(true))
    units.push(wrap)
  })

  return units.length > 0 ? units : null
}

function splitCaptureUnits(block: HTMLElement): HTMLElement[] {
  const scenarioCards = block.querySelectorAll('.scenario-card')
  if (scenarioCards.length > 0) {
    const units: HTMLElement[] = []
    const title = block.querySelector('h3')
    if (title) {
      const wrap = document.createElement('div')
      wrap.className = 'pdf-split-unit'
      wrap.appendChild(title.cloneNode(true))
      units.push(wrap)
    }
    scenarioCards.forEach((card) => {
      const wrap = document.createElement('div')
      wrap.className = 'pdf-split-unit pdf-split-card'
      wrap.appendChild(card.cloneNode(true))
      units.push(wrap)
    })
    const table = block.querySelector('.table-wrap')
    if (table instanceof HTMLElement && !table.classList.contains('no-print-table')) {
      const wrap = document.createElement('div')
      wrap.className = 'pdf-split-unit'
      wrap.appendChild(table.cloneNode(true))
      units.push(wrap)
    }
    return units
  }

  const methodsUnits = splitMethodsCard(block)
  if (methodsUnits) return methodsUnits

  const chartUnits = splitChartCard(block)
  if (chartUnits) return chartUnits

  return [block]
}

function wrapPdfUnit(unit: HTMLElement, title: string | null): HTMLElement {
  if (!title) {
    const wrap = document.createElement('div')
    wrap.className = 'pdf-export-wrap pdf-page-block'
    wrap.appendChild(unit)
    return wrap
  }
  return wrapWithTitle(unit, title)
}

function wrapWithTitle(block: HTMLElement, title: string): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'pdf-export-wrap pdf-page-block'
  const heading = document.createElement('h2')
  heading.className = 'pdf-section-title'
  heading.textContent = title
  wrap.appendChild(heading)
  wrap.appendChild(block)
  return wrap
}

function applyStagingLayout(staging: HTMLElement) {
  staging.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    `width:${PDF_W_PX}px`,
    'max-width:calc(100vw - 16px)',
    'background:#fff',
    'color:#111',
    'z-index:2147483000',
    'pointer-events:none',
    'opacity:1',
    'visibility:visible',
    'display:block',
    'box-sizing:border-box',
    'padding:8px 12px',
    'overflow:visible',
    'height:auto',
  ].join(';')
}

async function captureBlock(html2canvas: Html2CanvasFn, block: HTMLElement): Promise<HTMLCanvasElement> {
  const width = Math.max(block.scrollWidth, block.offsetWidth, 200)
  const height = Math.max(block.scrollHeight, block.offsetHeight, 40)
  block.style.width = `${width}px`
  block.style.minHeight = `${height}px`
  return html2canvas(block, {
    scale: PDF_SCALE,
    backgroundColor: '#ffffff',
    useCORS: true,
    allowTaint: true,
    logging: false,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    scrollX: 0,
    scrollY: 0,
    foreignObjectRendering: false,
    imageTimeout: 15000,
  })
}

async function captureWrapped(html2canvas: Html2CanvasFn, wrapped: HTMLElement): Promise<HTMLCanvasElement | null> {
  const staging = document.createElement('div')
  staging.className = 'pdf-staging'
  applyStagingLayout(staging)
  wrapped.classList.add('pdf-capture-root')
  staging.appendChild(wrapped)
  document.body.appendChild(staging)
  const paintMs = wrapped.querySelector('.chart-wrap') ? 320 : 150
  await waitForPaint(paintMs)
  try {
    const width = Math.max(staging.scrollWidth, PDF_W_PX)
    const height = Math.max(wrapped.scrollHeight, wrapped.offsetHeight, 40)
    wrapped.style.width = `${width}px`
    wrapped.style.minHeight = `${height}px`
    const canvas = await captureBlock(html2canvas, staging)
    if (!canvas || canvas.width < 2 || canvas.height < 2) return null
    return canvas
  } finally {
    wrapped.classList.remove('pdf-capture-root')
    staging.remove()
  }
}

function unitIsAtomic(unit: HTMLElement): boolean {
  return unit.classList.contains('pdf-split-card') || unit.classList.contains('pdf-chart-only')
}

function appendCanvasToPdf(
  pdf: JsPdfDoc,
  canvas: HTMLCanvasElement,
  margin: number,
  contentW: number,
  pageRef: { started: boolean; cursorY: number },
  options: { atomic?: boolean } = {},
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
    pageRef.cursorY += drawH + 4
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
}

function blockForSection(sec: PdfSectionDef, meta: PdfExportMeta): HTMLElement | null {
  if (sec.kind === 'cover') return buildCover(meta)
  if (!sec.selector) return null
  const el = document.querySelector(sec.selector)
  if (!el || !(el instanceof HTMLElement)) return null
  const clone = el.cloneNode(true) as HTMLElement
  clone.style.display = 'block'
  clone.style.visibility = 'visible'
  clone.style.opacity = '1'
  copySvgFromSource(el, clone)
  prepareCloneForPdf(clone)
  return clone
}

export async function exportSectionsToPdf(selectedIds: string[], meta: PdfExportMeta): Promise<void> {
  const { html2canvas, jsPDF } = await loadPdfLibs()
  const ordered = sortSectionIds(selectedIds)
  if (!ordered.length) throw new Error('Выберите хотя бы один раздел.')

  const secMap = new Map(PDF_SECTIONS.map((s) => [s.id, s]))
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  const margin = PDF_MARGIN_MM
  const contentW = pdf.internal.pageSize.getWidth() - margin * 2
  const pageRef = { started: false, cursorY: 0 }
  let hasContent = false

  await waitForPdfPaint(200)

  for (const id of ordered) {
    const sec = secMap.get(id)
    if (!sec) continue
    const block = blockForSection(sec, meta)
    if (!block) continue

    if (sec.kind === 'cover') {
      const canvas = await captureWrapped(html2canvas, block)
      if (!canvas) continue
      appendCanvasToPdf(pdf, canvas, margin, contentW, pageRef, { atomic: true })
      hasContent = true
      continue
    }

    const units = splitCaptureUnits(block)
    const liveSection = sec.selector ? document.querySelector(sec.selector) : null
    for (let i = 0; i < units.length; i += 1) {
      const unit = units[i]
      if (liveSection instanceof HTMLElement) {
        refreshChartSvgsFromLive(liveSection, unit)
      }
      const wrapped = wrapPdfUnit(unit, i === 0 ? sec.label : null)
      const canvas = await captureWrapped(html2canvas, wrapped)
      if (!canvas) continue
      appendCanvasToPdf(pdf, canvas, margin, contentW, pageRef, { atomic: unitIsAtomic(unit) })
      hasContent = true
    }
  }

  if (!hasContent) throw new Error('Не удалось собрать PDF: выбранные разделы не найдены на странице.')

  const pageCount = pdf.getNumberOfPages()
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page)
    pdf.setFontSize(8)
    pdf.setTextColor(130)
    pdf.text(`Daogreen · berry-calculator · ${page}/${pageCount}`, pageW / 2, pageH - 5, { align: 'center' })
  }

  const datePart = meta.date.replace(/\./g, '-')
  pdf.save(`berry-calculator-${datePart}.pdf`)
}
