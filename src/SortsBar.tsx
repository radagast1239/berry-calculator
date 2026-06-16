import { useState } from 'react'
import type { SortProfile } from './sortTypes'
import { MAX_SORTS } from './sortTypes'

export function SortsBar({
  sorts,
  activeSortId,
  compareOpen,
  onSelect,
  onAdd,
  onRemove,
  onRename,
  onToggleCompare,
}: {
  sorts: SortProfile[]
  activeSortId: string
  compareOpen: boolean
  onSelect: (id: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onRename: (id: string, name: string) => void
  onToggleCompare: () => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

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

  return (
    <section className="sorts-bar crop-block">
      <div className="sorts-bar-head">
        <h3>Сорта ({sorts.length}/{MAX_SORTS})</h3>
        <div className="sorts-bar-actions">
          <button type="button" onClick={onToggleCompare} className={compareOpen ? 'active' : ''}>
            {compareOpen ? 'Скрыть сравнение' : 'Сравнить сорта'}
          </button>
          <button type="button" onClick={onAdd} disabled={sorts.length >= MAX_SORTS}>
            + Сорт
          </button>
        </div>
      </div>
      <p className="hint">
        До {MAX_SORTS} сортов: параметры урожая сохраняются отдельно. Общие настройки фермы (плотность, площадь,
        коэффициенты) — общие для всех сортов.
      </p>
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
            <button
              type="button"
              className="sort-tab-rename"
              title="Переименовать"
              onClick={() => startRename(sort)}
            >
              ✎
            </button>
            {sorts.length > 1 && (
              <button
                type="button"
                className="sort-tab-remove"
                title="Удалить сорт"
                onClick={() => onRemove(sort.id)}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
