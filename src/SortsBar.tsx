import { useRef, useState, type ChangeEvent } from 'react'
import type { SortProfile } from './sortTypes'
import { MAX_SORTS } from './sortTypes'

export function SortsBar({
  sorts,
  activeSortId,
  activeNotes,
  compareOpen,
  savedHint,
  onSelect,
  onAdd,
  onDuplicate,
  onRemove,
  onRename,
  onNotesChange,
  onToggleCompare,
  onExportJson,
  onImportJson,
}: {
  sorts: SortProfile[]
  activeSortId: string
  activeNotes: string
  compareOpen: boolean
  savedHint?: string
  onSelect: (id: string) => void
  onAdd: () => void
  onDuplicate: (id: string) => void
  onRemove: (id: string) => void
  onRename: (id: string, name: string) => void
  onNotesChange: (notes: string) => void
  onToggleCompare: () => void
  onExportJson: () => void
  onImportJson: (text: string) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const startRename = (sort: SortProfile) => {
    setEditingId(sort.id)
    setEditName(sort.name)
  }

  const commitRename = () => {
    if (editingId) {
      onRename(editingId, editName)
      setEditingId(null)
    }
  }

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    onImportJson(text)
    event.target.value = ''
  }

  return (
    <section className="sorts-bar crop-block" id="pdf-sec-sorts-bar">
      <div className="sorts-bar-head">
        <h3>Мои сорта ({sorts.length}/{MAX_SORTS})</h3>
        {savedHint && <span className="sorts-saved-hint">{savedHint}</span>}
      </div>

      <button type="button" className="btn-add-sort primary" onClick={onAdd} disabled={sorts.length >= MAX_SORTS}>
        ➕ Добавить свой сорт
      </button>

      <p className="hint">
        До {MAX_SORTS} сортов. Параметры урожая сохраняются автоматически в браузере. Общие настройки фермы (плотность,
        площадь, коэффициенты) — для всех сортов.
      </p>

      <div className="sorts-bar-actions">
        <button type="button" onClick={onToggleCompare} className={compareOpen ? 'active' : ''}>
          {compareOpen ? 'Скрыть сравнение' : 'Сравнить сорта'}
        </button>
        <button type="button" onClick={onExportJson}>
          Экспорт JSON
        </button>
        <button type="button" onClick={() => fileRef.current?.click()}>
          Импорт JSON
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
      </div>

      <div className="sorts-tabs">
        {sorts.map((sort) => (
          <div key={sort.id} className={`sort-tab ${sort.id === activeSortId ? 'active' : ''}`}>
            {editingId === sort.id ? (
              <input
                className="sort-rename-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') setEditingId(null)
                }}
                autoFocus
              />
            ) : (
              <button type="button" className="sort-tab-btn" onClick={() => onSelect(sort.id)}>
                {sort.name}
              </button>
            )}
            <button type="button" className="sort-tab-rename" title="Переименовать" onClick={() => startRename(sort)}>
              ✎
            </button>
            <button type="button" className="sort-tab-rename" title="Дублировать" onClick={() => onDuplicate(sort.id)}>
              ⧉
            </button>
            {sorts.length > 1 && (
              <button type="button" className="sort-tab-remove" title="Удалить" onClick={() => onRemove(sort.id)}>
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <label className="field sort-notes-field">
        <span>Заметки к сорту «{sorts.find((s) => s.id === activeSortId)?.name ?? '—'}»</span>
        <textarea
          rows={2}
          value={activeNotes}
          placeholder="Источник данных, год теста, особенности сорта…"
          onChange={(e) => onNotesChange(e.target.value)}
        />
      </label>
    </section>
  )
}
