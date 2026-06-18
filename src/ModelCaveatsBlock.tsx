export function ModelCaveatsBlock({
  title = 'Ограничения и факторы риска',
  items,
  compact = false,
}: {
  title?: string
  items: string[]
  compact?: boolean
}) {
  if (!items.length) return null
  return (
    <div className={`model-caveats ${compact ? 'model-caveats-compact' : ''}`}>
      <p className="model-caveats-title">{title}</p>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
