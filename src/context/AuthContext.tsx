import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { CREDENTIALS, STORAGE_KEY } from '../config/auth'

interface AuthContextValue {
  isAuthenticated: boolean
  username: string | null
  login: (username: string, password: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredAuth(): { authenticated: boolean; username: string | null } {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored === 'true') {
      return { authenticated: true, username: CREDENTIALS.username }
    }
  } catch {
    /* sessionStorage unavailable */
  }
  return { authenticated: false, username: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = readStoredAuth()
  const [isAuthenticated, setIsAuthenticated] = useState(initial.authenticated)
  const [username, setUsername] = useState<string | null>(initial.username)

  const login = useCallback((user: string, password: string) => {
    const valid =
      user.trim() === CREDENTIALS.username && password === CREDENTIALS.password

    if (valid) {
      setIsAuthenticated(true)
      setUsername(CREDENTIALS.username)
      try {
        sessionStorage.setItem(STORAGE_KEY, 'true')
      } catch {
        /* ignore */
      }
    }

    return valid
  }, [])

  const logout = useCallback(() => {
    setIsAuthenticated(false)
    setUsername(null)
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
