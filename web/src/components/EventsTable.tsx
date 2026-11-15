import { EVENTS_PAGE_SIZE, type EventsResponse, type Loadable } from '../api'
import { formatEventTime, formatInt, formatRub } from '../format'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'ok', label: 'ok' },
  { value: 'error', label: 'error' },
]

interface Props {
  result: Loadable<EventsResponse>
  models: string[]
  model: string
  status: string
  onModelChange: (value: string) => void
  onStatusChange: (value: string) => void
  onPage: (offset: number) => void
}

export function EventsTable({
  result,
  models,
  model,
  status,
  onModelChange,
  onStatusChange,
  onPage,
}: Props) {
  const data = result.data
  const rows = data?.items ?? []
  const offset = data?.offset ?? 0
  const total = data?.total ?? 0
  const limit = data?.limit ?? EVENTS_PAGE_SIZE

  return (
    <section className="panel events">
      <div className="panel-head">
        <h2>События</h2>
        <div className="filters">
          <label className="field inline">
            <span>Модель</span>
            <select value={model} onChange={(event) => onModelChange(event.target.value)}>
              <option value="">Все модели</option>
              {models.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="field inline">
            <span>Статус</span>
            <select value={status} onChange={(event) => onStatusChange(event.target.value)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {result.loading ? (
        <p className="hint">Загрузка…</p>
      ) : result.error ? (
        <p className="error">{result.error}</p>
      ) : rows.length === 0 ? (
        <p className="hint">Нет событий</p>
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Модель</th>
                  <th className="num">Токены in</th>
                  <th className="num">Токены out</th>
                  <th className="num">Cached</th>
                  <th className="num">Задержка</th>
                  <th>Статус</th>
                  <th className="num">Стоимость</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="nowrap">{formatEventTime(row.ts)}</td>
                    <td className="nowrap">{row.model}</td>
                    <td className="num">{formatInt(row.tokens_in)}</td>
                    <td className="num">{formatInt(row.tokens_out)}</td>
                    <td className="num">{formatInt(row.cached_tokens)}</td>
                    <td className="num">{formatInt(row.latency_ms)} мс</td>
                    <td>
                      <span className={`badge ${row.status === 'ok' ? 'ok' : 'err'}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="num">{formatRub(row.cost_rub, 6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pager">
            <button
              type="button"
              className="secondary"
              onClick={() => onPage(Math.max(0, offset - limit))}
              disabled={offset === 0}
            >
              Назад
            </button>
            <span className="hint">
              {offset + 1}–{offset + rows.length} из {total}
            </span>
            <button
              type="button"
              className="secondary"
              onClick={() => onPage(offset + limit)}
              disabled={offset + limit >= total}
            >
              Вперёд
            </button>
          </div>
        </>
      )}
    </section>
  )
}
