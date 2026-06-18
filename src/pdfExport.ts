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
    description: 'Кг товарной ягоды по месяцам для сценариев Мин, Средний и Макс (в PDF — все три).',
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
    id: 'chart-dn-calendar',
    label: 'Календарь НСД по волнам',
    description: 'Распределение урожая НСД по месяцам — в PDF для Мин, Средний и Макс.',
    group: 'charts',
    selector: '#pdf-sec-chart-dn-calendar',
    crop: 'DN',
    advanced: true,
  },
  {
    id: 'chart-dn-profile',
    label: 'Профиль волны НСД',
    description: 'Форма сбора внутри цикла — в PDF для всех сценариев.',
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
  client: ['cover', 'methods', 'results-sd', 'results-dn', 'chart-compare', 'chart-farm-monthly'],
  brief: ['cover', 'methods', 'results-sd', 'results-dn', 'chart-compare', 'chart-farm-monthly'],
  investor: [
    'cover',
    'methods',
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
  brief: 'Титул, формулы, результаты (Мин/Средний/Макс) и графики по всем сценариям.',
  client: 'Как «Краткий» — в PDF все три сценария на графиках.',
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
  const dstSvgs = clone.querySelectorAll('svg.recharts-surface')
  dstSvgs.forEach((dst, index) => {
    const src = srcSvgs[index]
    if (!src) return
    const svg = dst as SVGElement
    const width = src.getBoundingClientRect().width || src.clientWidth || 700
    const height = src.getBoundingClientRect().height || src.clientHeight || 280
    svg.setAttribute('width', String(Math.round(width)))
    svg.setAttribute('height', String(Math.round(height)))
    svg.style.width = `${Math.round(width)}px`
    svg.style.height = `${Math.round(height)}px`
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
  root.querySelectorAll('.chart-wrap').forEach((el) => {
    const node = el as HTMLElement
    node.style.height = `${node.offsetHeight || 280}px`
    node.style.minHeight = `${node.offsetHeight || 280}px`
  })
  root.querySelectorAll('.scenario-cards').forEach((el) => {
    const node = el as HTMLElement
    node.style.gridTemplateColumns = '1fr'
    node.style.gap = '8px'
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
  staging.appendChild(wrapped)
  document.body.appendChild(staging)
  await waitForPaint(150)
  try {
    const canvas = await captureBlock(html2canvas, staging)
    if (!canvas || canvas.width < 2 || canvas.height < 2) return null
    return canvas
  } finally {
    staging.remove()
  }
}

function appendCanvasToPdf(
  pdf: JsPdfDoc,
  canvas: HTMLCanvasElement,
  margin: number,
  contentW: number,
  pageRef: { started: boolean },
) {
  const pageH = pdf.internal.pageSize.getHeight()
  const contentTop = margin + 10
  const usableH = pageH - contentTop - margin
  const pxPerMm = canvas.width / contentW
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

    if (pageRef.started) pdf.addPage()
    pageRef.started = true
    pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, contentTop, contentW, sliceHmm)
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
  const pageRef = { started: false }
  let hasContent = false

  await waitForPdfPaint(200)

  for (const id of ordered) {
    const sec = secMap.get(id)
    if (!sec) continue
    const block = blockForSection(sec, meta)
    if (!block) continue
    const wrapped = sec.kind === 'cover' ? block : wrapWithTitle(block, sec.label)
    const canvas = await captureWrapped(html2canvas, wrapped)
    if (!canvas) continue
    appendCanvasToPdf(pdf, canvas, margin, contentW, pageRef)
    hasContent = true
  }

  if (!hasContent) throw new Error('Не удалось собрать PDF: выбранные разделы не найдены на странице.')

  const pageCount = pdf.getNumberOfPages()
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page)
    pdf.setFontSize(8)
    pdf.setTextColor(130)
    pdf.text(`${meta.title} · Daogreen · стр. ${page}/${pageCount}`, pageW / 2, pageH - 5, { align: 'center' })
  }

  const datePart = meta.date.replace(/\./g, '-')
  pdf.save(`berry-calculator-${datePart}.pdf`)
}
