import { useEffect, useMemo, useRef, useState } from 'react'
import type { CropType } from './types'
import {
  defaultPdfSelection,
  getAvailablePdfSections,
  PDF_GROUP_LABELS,
  PDF_PRESETS,
  type PdfSectionGroup,
} from './pdfExport'

interface PdfExportDialogProps {
  open: boolean
  cropType: CropType
  clientMode: boolean
  exporting: boolean
  onClose: () => void
  onExport: (sectionIds: string[]) => void
}

export function PdfExportDialog({
  open,
  cropType,
  clientMode,
  exporting,
  onClose,
  onExport,
}: PdfExportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(defaultPdfSelection(cropType, clientMode)))

  const sections = useMemo(
    () => (open ? getAvailablePdfSections(cropType, clientMode) : []),
    [cropType, clientMode, open],
  )

  const grouped = useMemo(() => {
    const groups = new Map<PdfSectionGroup, typeof sections>()
    sections.forEach((sec) => {
      const list = groups.get(sec.group) ?? []
      list.push(sec)
      groups.set(sec.group, list)
    })
    return groups
  }, [sections])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      setSelected(new Set(defaultPdfSelection(cropType, clientMode)))
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) {
      dialog.close()
    }
  }, [open, cropType, clientMode])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const applyPreset = (ids: string[]) => {
    const available = new Set(sections.map((s) => s.id))
    setSelected(new Set(ids.filter((id) => available.has(id))))
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!selected.size) {
      window.alert('Выберите хотя бы один раздел.')
      return
    }
    onExport(Array.from(selected))
  }

  return (
    <dialog
      ref={dialogRef}
      className="pdf-export-dialog"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClose={onClose}
    >
      <form method="dialog" className="pdf-export-form" onSubmit={handleSubmit}>
        <h2 className="pdf-export-title">Выгрузка в PDF</h2>
        <p className="pdf-export-lead">Отметьте разделы для файла. Печать не используется — файл скачается сразу.</p>

        <div className="pdf-export-toolbar">
          <button type="button" onClick={() => applyPreset(PDF_PRESETS.brief)}>
            Краткий
          </button>
          <button type="button" onClick={() => applyPreset(PDF_PRESETS.client)}>
            Для клиента
          </button>
          <button type="button" onClick={() => applyPreset(PDF_PRESETS.investor)}>
            Для инвестора
          </button>
          <button type="button" onClick={() => applyPreset(PDF_PRESETS.full)}>
            Полный
          </button>
          <button type="button" onClick={() => setSelected(new Set(sections.map((s) => s.id)))}>
            Все
          </button>
          <button type="button" onClick={() => setSelected(new Set())}>
            Снять
          </button>
        </div>

        <div className="pdf-export-checklist">
          {Array.from(grouped.entries()).map(([group, items]) => (
            <fieldset key={group} className="pdf-export-group">
              <legend>{PDF_GROUP_LABELS[group]}</legend>
              {items.map((sec) => (
                <label key={sec.id} className="pdf-export-item">
                  <input
                    type="checkbox"
                    checked={selected.has(sec.id)}
                    onChange={() => toggle(sec.id)}
                  />
                  {sec.label}
                </label>
              ))}
            </fieldset>
          ))}
        </div>

        <div className="pdf-export-actions">
          <button type="button" onClick={onClose} disabled={exporting}>
            Отмена
          </button>
          <button type="submit" className="primary" disabled={exporting}>
            {exporting ? 'Формирую PDF…' : 'Скачать PDF'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
