import { useEffect, useMemo, useState, type DependencyList } from 'react'
import {
  ApiError,
  EVENTS_PAGE_SIZE,
  fetchEvents,
  fetchStats,
  type EventsResponse,
  type Loadable,
  type StatsResponse,
} from '../api'
import { createPeriod, periodLabel, resolveRange, type Period } from '../period'
import { CostChart } from './CostChart'
import { EventsTable } from './EventsTable'
import { ModelChart } from './ModelChart'
import { PeriodPicker } from './PeriodPicker'
import { StatCards } from './StatCards'

/** Запрос с состоянием загрузки/ошибки; null-загрузчик означает некорректный период. */
function useLoadable<T>(
  load: (() => Promise<T>) | null,
  deps: DependencyList,
  onUnauthorized: () => void,
): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ loading: true })

  useEffect(() => {
    if (!load) {
      setState({ loading: false, error: 'Выберите корректный период' })
      return
    }
    let alive = true
    setState({ loading: true })
    load().then(
      (data) => {
        if (alive) setState({ data, loading: false })
      },
      (error: unknown) => {
        if (!alive) return
        if (error instanceof ApiError && error.status === 401) onUnauthorized()
        setState({
          loading: false,
          error: error instanceof Error ? error.message : 'Ошибка запроса',
        })
      },
    )
    return () => {
      alive = false
    }
  }, deps)

  return state
}

export function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [period, setPeriod] = useState<Period>(() => createPeriod('7'))
  const [offset, setOffset] = useState(0)
  const [model, setModel] = useState('')
  const [status, setStatus] = useState('all')

  const range = useMemo(() => resolveRange(period), [period])

  const dayStats = useLoadable<StatsResponse>(
    range ? () => fetchStats({ from: range.fromIso, to: range.toIso, group: 'day' }) : null,
    [range],
    onLogout,
  )

  const modelStats = useLoadable<StatsResponse>(
    range ? () => fetchStats({ from: range.fromIso, to: range.toIso, group: 'model' }) : null,
    [range],
    onLogout,
  )

  const events = useLoadable<EventsResponse>(
    range
      ? () =>
          fetchEvents({
            from: range.fromIso,
            to: range.toIso,
            model: model || undefined,
            status: status === 'all' ? undefined : status,
            limit: EVENTS_PAGE_SIZE,
            offset,
          })
      : null,
    [range, model, status, offset],
    onLogout,
  )

  const models = (modelStats.data?.rows ?? []).map((row) => row.bucket)

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>LLM Meter</h1>
          <p className="sub">Период: {periodLabel(range)}</p>
        </div>
        <button type="button" className="secondary" onClick={onLogout}>
          Выйти
        </button>
      </header>

      <PeriodPicker
        value={period}
        onChange={(next) => {
          setPeriod(next)
          setOffset(0)
        }}
      />

      <StatCards result={dayStats} />

      <div className="charts">
        <CostChart result={dayStats} />
        <ModelChart result={modelStats} />
      </div>

      <EventsTable
        result={events}
        models={models}
        model={model}
        status={status}
        onModelChange={(next) => {
          setModel(next)
          setOffset(0)
        }}
        onStatusChange={(next) => {
          setStatus(next)
          setOffset(0)
        }}
        onPage={setOffset}
      />
    </div>
  )
}
