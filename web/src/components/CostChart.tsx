import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Loadable, StatsResponse } from '../api'
import { formatDayShort, formatRub } from '../format'
import { AXIS_STROKE, AXIS_TICK, GRID_STROKE, TOOLTIP_STYLE } from './chartTheme'

export function CostChart({ result }: { result: Loadable<StatsResponse> }) {
  const data = (result.data?.rows ?? []).map((row) => ({
    label: formatDayShort(new Date(row.bucket)),
    cost: row.cost_rub,
  }))

  return (
    <section className="panel">
      <h2>Стоимость по дням</h2>
      {result.loading ? (
        <p className="hint">Загрузка…</p>
      ) : result.error ? (
        <p className="error">{result.error}</p>
      ) : data.length === 0 ? (
        <p className="hint">Нет данных за период</p>
      ) : (
        <div className="chart">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke={AXIS_STROKE} tick={AXIS_TICK} />
              <YAxis stroke={AXIS_STROKE} tick={AXIS_TICK} width={64} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value) => formatRub(Number(value))}
                labelFormatter={(label) => `Дата: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="cost"
                name="Стоимость"
                stroke="#5b8cff"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
