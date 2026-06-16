import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import type { CropType } from './types'

export type BenchmarkLevel = 'low' | 'ok' | 'warn' | 'high'

export const BENCHMARK_LEVEL_LABELS: Record<BenchmarkLevel, string> = {
  low: 'Ниже подтверждённого диапазона',
  ok: 'В подтверждённом диапазоне',
  warn: 'Между подтверждённым и потолком',
  high: 'Выше потолочного ориентира',
}

export function getBenchmarkLevel(
  crop: 'SD' | 'DN',
  value: number,
  benchmarks: {
    SD: { confirmed: readonly [number, number]; ceiling: readonly [number, number] }
    DN: { confirmed: readonly [number, number]; ceiling: readonly [number, number] }
  },
): BenchmarkLevel {
  const b = benchmarks[crop]
  if (value < b.confirmed[0]) return 'low'
  if (value <= b.confirmed[1]) return 'ok'
  if (value <= b.ceiling[1]) return 'warn'
  return 'high'
}

export const FIELD_HINTS: Record<string, string> = {
  density: 'Число растений на 1 м² полезной поверхности ярусов. Линейно масштабирует урожай.',
  farmAreaM2: 'Посевная полезная площадь фермы для расчёта урожая всей площадки (кг/год и кг/мес).',
  uncertaintyPct:
    'Насколько широким будет диапазон «пессимистичный — реалистичный — оптимистичный» (10%/50%/90%) на графике ниже. Карточки Мин/Средний/Макс и основные цифры не меняются — меняется только разброс в симуляции.',
  kLosses: 'Доля урожая, теряемая из-за брака, пересорта и технологических потерь.',
  kPests: 'Снижение урожая из-за болезней, вредителей и стресса растений.',
  packout: 'Какая часть биологического урожая идёт в продажу как товарная ягода.',
  sdYield: 'Сколько килограммов ягоды даёт одно растение за один цикл КСД.',
  sdCycle: 'Длительность одного цикла КСД в месяцах. Определяет число циклов в год.',
  dnYield: 'Сколько килограммов ягоды даёт одно растение за один цикл НСД.',
  dnCycle: 'Длительность цикла НСД. Вместе с оборотом задаёт число циклов в год.',
  dnTurnaround: 'Пауза между циклами НСД: подготовка, обрезка, пересадка.',
}

export function HintLabel({ label, hint }: { label: string; hint?: string }) {
  if (!hint) return <span>{label}</span>
  return (
    <span className="hint-label">
      {label}
      <button type="button" className="hint-trigger" title={hint} aria-label={`Подсказка: ${label}`}>
        ?
      </button>
      <span className="hint-tooltip" role="tooltip">
        {hint}
      </span>
    </span>
  )
}

export function Toast({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>
  )
}

export function StickySummary({
  cropType,
  sdAvg,
  dnAvg,
  visible,
}: {
  cropType: CropType
  sdAvg: number
  dnAvg: number
  visible: boolean
}) {
  if (!visible) return null
  return (
    <div className="sticky-summary" aria-hidden={!visible}>
      <div className="sticky-summary-inner">
        <strong>Итог (средний сценарий)</strong>
        {cropType === 'both' && (
          <span>
            КСД: {sdAvg.toFixed(1)} · НСД: {dnAvg.toFixed(1)} кг/м² полезной посевной площади/год
          </span>
        )}
        {cropType === 'SD' && <span>КСД: {sdAvg.toFixed(1)} кг/м² полезной посевной площади/год</span>}
        {cropType === 'DN' && <span>НСД: {dnAvg.toFixed(1)} кг/м² полезной посевной площади/год</span>}
      </div>
    </div>
  )
}

export function QrModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState('')

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 220 }).then(setDataUrl).catch(() => setDataUrl(''))
  }, [url])

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="qr-title">
        <h3 id="qr-title">QR-код для доступа к калькулятору</h3>
        <p className="hint">Отсканируйте камерой телефона — откроется текущая ссылка с параметрами.</p>
        {dataUrl ? <img src={dataUrl} alt="QR-код ссылки на калькулятор" className="qr-image" /> : <p>Генерация QR…</p>}
        <p className="qr-url">{url}</p>
        <button type="button" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  )
}

export type WizardStep = 0 | 1 | 2

export function SetupWizard({
  step,
  cropType,
  density,
  farmAreaM2,
  kLosses,
  kPests,
  packout,
  onCropType,
  onDensity,
  onFarmArea,
  onKLosses,
  onKPests,
  onPackout,
  onStep,
  onClose,
}: {
  step: WizardStep
  cropType: CropType
  density: number
  farmAreaM2: number
  kLosses: number
  kPests: number
  packout: number
  onCropType: (v: CropType) => void
  onDensity: (v: number) => void
  onFarmArea: (v: number) => void
  onKLosses: (v: number) => void
  onKPests: (v: number) => void
  onPackout: (v: number) => void
  onStep: (s: WizardStep) => void
  onClose: () => void
}) {
  return (
    <div className="modal-backdrop wizard-backdrop" role="presentation">
      <div className="modal-card wizard-card" role="dialog" aria-labelledby="wizard-title">
        <h3 id="wizard-title">Мастер настройки · шаг {step + 1} из 3</h3>

        {step === 0 && (
          <>
            <p className="hint">Выберите тип культуры.</p>
            <div className="toggle wizard-toggle">
              {(['SD', 'DN', 'both'] as CropType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={cropType === type ? 'active' : ''}
                  onClick={() => onCropType(type)}
                >
                  {type === 'both' ? 'Сравнить оба' : type === 'SD' ? 'КСД' : 'НСД'}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p className="hint">Укажите масштаб фермы — этого достаточно для первого расчёта.</p>
            <label className="field">
              <HintLabel label="Плотность, раст/м²" hint={FIELD_HINTS.density} />
              <input type="number" min={1} max={90} value={density} onChange={(e) => onDensity(Number(e.target.value))} />
            </label>
            <label className="field">
              <HintLabel label="Посевная полезная площадь фермы, м²" hint={FIELD_HINTS.farmAreaM2} />
              <input type="number" min={1} step={0.1} value={farmAreaM2} onChange={(e) => onFarmArea(Number(e.target.value))} />
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <p className="hint">Укажите коэффициенты качества вручную.</p>
            <label className="field">
              <HintLabel label="Коэффициент технологических потерь" hint={FIELD_HINTS.kLosses} />
              <input
                type="number"
                min={0.3}
                max={1}
                step={0.01}
                value={kLosses}
                onChange={(e) => onKLosses(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <HintLabel label="Коэффициент рисков (болезни/вредители)" hint={FIELD_HINTS.kPests} />
              <input
                type="number"
                min={0.3}
                max={1}
                step={0.01}
                value={kPests}
                onChange={(e) => onKPests(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <HintLabel label="Доля товарной ягоды" hint={FIELD_HINTS.packout} />
              <input
                type="number"
                min={0.5}
                max={1}
                step={0.01}
                value={packout}
                onChange={(e) => onPackout(Number(e.target.value))}
              />
            </label>
          </>
        )}

        <div className="wizard-actions">
          {step > 0 && (
            <button type="button" onClick={() => onStep((step - 1) as WizardStep)}>
              Назад
            </button>
          )}
          {step < 2 ? (
            <button type="button" className="primary" onClick={() => onStep((step + 1) as WizardStep)}>
              Далее
            </button>
          ) : (
            <button type="button" className="primary" onClick={onClose}>
              Готово
            </button>
          )}
          <button type="button" className="ghost" onClick={onClose}>
            Пропустить
          </button>
        </div>
      </div>
    </div>
  )
}

export function useUndoStack<T>(max = 25) {
  const stackRef = useRef<T[]>([])

  const push = (snapshot: T) => {
    stackRef.current = [...stackRef.current.slice(-(max - 1)), snapshot]
  }

  const pop = (): T | undefined => {
    const next = stackRef.current.pop()
    return next
  }

  const canUndo = () => stackRef.current.length > 0

  return { push, pop, canUndo }
}

export function useStickyVisible(threshold = 180) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return visible
}

export function useIsMobileGuide() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 520px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return isMobile
}
