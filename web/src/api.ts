const TOKEN_KEY = 'llm_meter_token'

export const EVENTS_PAGE_SIZE = 50

export interface EventItem {
  id: string
  event_id: string
  ts: string
  model: string
  tokens_in: number
  tokens_out: number
  cached_tokens: number
  latency_ms: number
  status: string
  cost_rub: number
  task_id: string | null
  meta: unknown
}

export interface EventsResponse {
  items: EventItem[]
  total: number
  limit: number
  offset: number
}

export interface StatsRow {
  bucket: string
  events: number
  tokens_in: number
  tokens_out: number
  cached_tokens: number
  cost_rub: number
  avg_latency_ms: number
  error_rate: number
}

export interface StatsResponse {
  from: string
  to: string
  group: 'day' | 'model'
  rows: StatsRow[]
}

/** Состояние одного запроса: данные, индикатор загрузки, текст ошибки. */
export interface Loadable<T> {
  data?: T
  loading: boolean
  error?: string
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

let token: string | null = localStorage.getItem(TOKEN_KEY)

export function getToken(): string | null {
  return token
}

function setToken(value: string): void {
  token = value
  localStorage.setItem(TOKEN_KEY, value)
}

export function clearToken(): void {
  token = null
  localStorage.removeItem(TOKEN_KEY)
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  const encoded = query.toString()
  return encoded ? `?${encoded}` : ''
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res: Response
  try {
    res = await fetch(`/api${path}`, { ...init, headers })
  } catch {
    throw new ApiError(0, 'Сервер недоступен, проверьте соединение')
  }

  if (res.status === 401 && token) {
    clearToken()
    throw new ApiError(401, 'Сессия истекла, войдите заново')
  }

  if (!res.ok) {
    let message = `Ошибка запроса (${res.status})`
    try {
      const body = (await res.json()) as { error?: unknown }
      if (typeof body.error === 'string') message = body.error
    } catch {
      // тело не JSON — остаётся общий текст
    }
    throw new ApiError(res.status, message)
  }

  return (await res.json()) as T
}

export async function login(loginName: string, password: string): Promise<void> {
  const body = JSON.stringify({ login: loginName, password })
  const data = await request<{ token: string }>('/auth/login', { method: 'POST', body })
  setToken(data.token)
}

export function fetchStats(params: {
  from: string
  to: string
  group: 'day' | 'model'
}): Promise<StatsResponse> {
  return request<StatsResponse>(`/stats${buildQuery(params)}`)
}

export function fetchEvents(params: {
  from: string
  to: string
  model?: string
  status?: string
  limit: number
  offset: number
}): Promise<EventsResponse> {
  return request<EventsResponse>(`/events${buildQuery(params)}`)
}
