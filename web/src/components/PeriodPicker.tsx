import { useEffect, useState } from 'react'
import { formatDateInput, resolveRange, type Period } from '../period'

export function PeriodPicker({
  value,
  onChange,
}: {
  value: Period
  onChange: (period: Period) => void
}) {
  const now = new Date()
  const today = formatDateInput(now)
  const weekAgo = formatDateInput(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6))
  const [customFrom, setCustomFrom] = useState(value.kind === 'custom' ? value.from : weekAgo)
  const [customTo, setCustomTo] = useState(value.kind === 'custom' ? value.to : today)

  // Пресет "7"/"30" подставляет в поля фактические границы периода — те же, что уходят в API.
  useEffect(() => {
    if (value.kind === 'custom') return
    const range = resolveRange(value)
    if (!range) return
    const last = new Date(range.to)
    last.setDate(last.getDate() - 1)
    setCustomFrom(formatDateInput(range.from))
    setCustomTo(formatDateInput(last))
  }, [value])

  const invalid = !customFrom || !customTo || customFrom > customTo

  const applyCustom = () => {
    if (!invalid) onChange({ kind: 'custom', from: customFrom, to: customTo })
  }

  return (
    <div className="period-picker">
      <div className="segmented">
        <button
          type="button"
          className={value.kind === '7' ? 'active' : ''}
          onClick={() => onChange({ ...value, kind: '7' })}
        >
          7 дней
        </button>
        <button
          type="button"
          className={value.kind === '30' ? 'active' : ''}
          onClick={() => onChange({ ...value, kind: '30' })}
        >
          30 дней
        </button>
        <button
          type="button"
          className={value.kind === 'custom' ? 'active' : ''}
          onClick={applyCustom}
        >
          Произвольный
        </button>
      </div>

      <div className="custom-range">
        <label className="field inline">
          <span>С</span>
          <input
            type="date"
            value={customFrom}
            max={customTo || undefined}
            onChange={(event) => setCustomFrom(event.target.value)}
          />
        </label>
        <label className="field inline">
          <span>По</span>
          <input
            type="date"
            value={customTo}
            min={customFrom || undefined}
            onChange={(event) => setCustomTo(event.target.value)}
          />
        </label>
        <button type="button" className="secondary" onClick={applyCustom} disabled={invalid}>
          Применить
        </button>
      </div>
    </div>
  )
}
