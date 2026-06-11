import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { PageLoader } from './Spinner'
import type { UserRole } from './database'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth()

  if (loading) return <PageLoader />
  if (!user)   return <Navigate to="/login" replace />

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
