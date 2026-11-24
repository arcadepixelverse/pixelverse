import React from 'react'

interface AdminGuardProps {
  children: React.ReactNode
}

/**
 * Transparent security boundary: AdminConsole enforces atomic clearance,
 * session hydration, and visual panic displays directly.
 */
export function AdminGuard({ children }: AdminGuardProps) {
  return <>{children}</>
}

