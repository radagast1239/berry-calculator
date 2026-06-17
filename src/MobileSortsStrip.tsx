import type { SortProfile } from './sortTypes'
import { MAX_SORTS } from './sortTypes'

export function MobileSortsStrip({
  sorts,
  activeSortId,
  onSelect,
  onAdd,
}: {
  sorts: SortProfile[]
  activeSortId: string
  onSelect: (id: string) => void
  onAdd: () => void
}) {
  return (
    <div className="mobile-sorts-strip no-print">
      <div className="mobile-sorts-scroll">
        {sorts.map((sort) => (
          <button
            key={sort.id}
            type="button"
            className={sort.id === activeSortId ? 'active' : ''}
            onClick={() => onSelect(sort.id)}
          >
            {sort.name}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="ghost-btn mobile-sorts-add"
        onClick={onAdd}
        disabled={sorts.length >= MAX_SORTS}
      >
        + Сорт
      </button>
    </div>
  )
}
