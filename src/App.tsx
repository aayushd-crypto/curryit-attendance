import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { ProtectedRoute } from './ProtectedRoute'
import { AppLayout } from './AppLayout'
import { PageLoader } from './Spinner'
import { Suspense, lazy } from 'react'

const LoginPage       = lazy(() => import('./pages/Login'))
const Dashboard       = lazy(() => import('./pages/Dashboard'))
const CMKAttendance   = lazy(() => import('./pages/CMKAttendance'))
const LeavePage       = lazy(() => import('./pages/Leave'))
const EmployeesPage   = lazy(() => import('./pages/Employees'))
const ReportsPage     = lazy(() => import('./pages/Reports'))
const AuditLogPage    = lazy(() => import('./pages/AuditLog'))
const SettingsPage    = lazy(() => import('./pages/Settings'))
const ResetPassword   = lazy(() => import('./pages/ResetPassword'))

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/"      element={<Navigate to="/dashboard" replace />} />

            {/* Protected app routes */}
            <Route element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route path="/dashboard"       element={<Dashboard />} />

              <Route path="/cmk-attendance"  element={
                <ProtectedRoute allowedRoles={['super_admin','admin','cmk_coordinator']}>
                  <CMKAttendance />
                </ProtectedRoute>
              } />

              <Route path="/leave"           element={<LeavePage />} />

              <Route path="/employees"       element={
                <ProtectedRoute allowedRoles={['super_admin','admin']}>
                  <EmployeesPage />
                </ProtectedRoute>
              } />

              <Route path="/reports"         element={
                <ProtectedRoute allowedRoles={['super_admin','admin','cmk_coordinator']}>
                  <ReportsPage />
                </ProtectedRoute>
              } />

              <Route path="/audit-log"       element={
                <ProtectedRoute allowedRoles={['super_admin','admin']}>
                  <AuditLogPage />
                </ProtectedRoute>
              } />

              <Route path="/settings"        element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <SettingsPage />
                </ProtectedRoute>
              } />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
