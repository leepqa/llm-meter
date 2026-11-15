import { useCallback, useState } from 'react'
import { clearToken, getToken } from './api'
import { Dashboard } from './components/Dashboard'
import { LoginScreen } from './components/LoginScreen'

export default function App() {
  const [authed, setAuthed] = useState(() => getToken() !== null)

  const handleLogout = useCallback(() => {
    clearToken()
    setAuthed(false)
  }, [])

  return authed ? (
    <Dashboard onLogout={handleLogout} />
  ) : (
    <LoginScreen onSuccess={() => setAuthed(true)} />
  )
}
