import { useState, type FormEvent } from 'react'
import { ApiError, login } from '../api'

export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [loginName, setLoginName] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      await login(loginName.trim(), password)
      onSuccess()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Неверный логин или пароль')
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось войти')
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>LLM Meter</h1>
        <p className="hint">Наблюдаемость вызовов LLM</p>

        <label className="field">
          <span>Логин</span>
          <input
            value={loginName}
            onChange={(event) => setLoginName(event.target.value)}
            placeholder="admin"
            autoComplete="username"
            required
          />
        </label>

        <label className="field">
          <span>Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••"
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={pending}>
          {pending ? 'Вход…' : 'Войти'}
        </button>
      </form>
    </div>
  )
}
