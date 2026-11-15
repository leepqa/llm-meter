import type { Loadable, StatsResponse } from '../api'
import { formatInt, formatPercent, formatRub } from '../format'

export function StatCards({ result }: { result: Loadable<StatsResponse> }) {
  const rows = result.data?.rows ?? []
  const totals = rows.reduce(
    (acc, row) => ({
      tokens: acc.tokens + row.tokens_in + row.tokens_out,
      cost: acc.cost + row.cost_rub,
      latency: acc.latency + row.avg_latency_ms * row.events,
      errors: acc.errors + row.error_rate * row.events,
      events: acc.events + row.events,
    }),
    { tokens: 0, cost: 0, latency: 0, errors: 0, events: 0 },
  )

  const hasData = rows.length > 0
  const avgLatency = totals.events > 0 ? totals.latency / totals.events : 0
  // взвешенное по событиям среднее, а не среднее из error_rate по дням
  const errorRate = totals.events > 0 ? totals.errors / totals.events : 0

  const cards = [
    { label: 'Токены', value: hasData ? formatInt(totals.tokens) : '—' },
    { label: 'Стоимость', value: hasData ? formatRub(totals.cost) : '—' },
    { label: 'Средняя задержка', value: hasData ? `${formatInt(avgLatency)} мс` : '—' },
    { label: 'Доля ошибок', value: hasData ? formatPercent(errorRate) : '—' },
  ]

  return (
    <>
      <section className="cards">
        {cards.map((card) => (
          <div className="card" key={card.label}>
            <span className="card-label">{card.label}</span>
            <span className="card-value">{card.value}</span>
          </div>
        ))}
      </section>
      {result.loading && <p className="hint">Загрузка…</p>}
      {result.error && <p className="error">{result.error}</p>}
      {!result.loading && !result.error && !hasData && <p className="hint">Нет данных за период</p>}
    </>
  )
}
