import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Loadable, StatsResponse } from '../api'
import { formatRub } from '../format'
import { AXIS_STROKE, AXIS_TICK, GRID_STROKE, TOOLTIP_STYLE } from './chartTheme'

export function ModelChart({ result }: { result: Loadable<StatsResponse> }) {
  const data = (result.data?.rows ?? []).map((row) => ({
    model: row.bucket,
    cost: row.cost_rub,
  }))

  return (
    <section className="panel">
      <h2>Стоимость по моделям</h2>
      {result.loading ? (
        <p className="hint">Загрузка…</p>
      ) : result.error ? (
        <p className="error">{result.error}</p>
      ) : data.length === 0 ? (
        <p className="hint">Нет данных за период</p>
      ) : (
        <div className="chart">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="model" stroke={AXIS_STROKE} tick={{ ...AXIS_TICK, fontSize: 11 }} interval={0} />
              <YAxis stroke={AXIS_STROKE} tick={AXIS_TICK} width={64} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: 'rgba(91, 140, 255, 0.08)' }}
                formatter={(value) => formatRub(Number(value))}
              />
              <Bar dataKey="cost" name="Стоимость" fill="#5b8cff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
