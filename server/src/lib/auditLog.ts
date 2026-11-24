import { supabaseAdmin } from './supabase';

export interface AuditLogEntry {
  id?: string;
  timestamp: string;
  admin_email: string;
  action: string;
  target: string;
  details: any;
}

const MAX_IN_MEMORY_LOGS = 200;
const inMemoryAuditLogs: AuditLogEntry[] = [];

/**
 * Records an immutable admin audit log entry.
 * Attempts to persist to Supabase `admin_audit_logs` table.
 * Always records into the local in-memory circular buffer as a fail-safe fallback.
 */
export async function logAdminAction(
  admin_email: string,
  action: string,
  target: string,
  details: any = {}
): Promise<void> {
  const entry: AuditLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    admin_email: admin_email || 'system',
    action,
    target,
    details,
  };

  // 1. Add to in-memory buffer
  inMemoryAuditLogs.unshift(entry);
  if (inMemoryAuditLogs.length > MAX_IN_MEMORY_LOGS) {
    inMemoryAuditLogs.pop();
  }

  // 2. Try persisting to Supabase table
  try {
    const { error } = await supabaseAdmin.from('admin_audit_logs').insert({
      admin_email: entry.admin_email,
      action: entry.action,
      target: entry.target,
      details: entry.details,
      timestamp: entry.timestamp,
    });

    if (error) {
      // If table doesn't exist or RLS blocks, warn but do not throw
      console.warn('[auditLog] Notice: could not persist to DB table (using in-memory fallback):', error.message);
    }
  } catch (err: any) {
    console.warn('[auditLog] Exception inserting audit log to DB:', err?.message);
  }
}

/**
 * Retrieves the most recent audit logs.
 * Tries Supabase first; falls back to in-memory buffer if table is not configured.
 */
export async function getAuditLogs(limit: number = 100): Promise<AuditLogEntry[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_audit_logs')
      .select('id, timestamp, admin_email, action, target, details')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (!error && Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch (err: any) {
    console.warn('[auditLog] Fallback to in-memory audit logs:', err?.message);
  }

  return inMemoryAuditLogs.slice(0, limit);
}
