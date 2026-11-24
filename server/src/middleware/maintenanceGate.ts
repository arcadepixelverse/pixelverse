import { Request, Response, NextFunction } from 'express';
import { getMaintenanceMode } from '../lib/gameStatus';
import { isOwnerEmail } from '../lib/owner';

/**
 * Universal Maintenance Mode Gate
 * Blocks non-admin gameplay requests with 503 MAINTENANCE_MODE when active.
 * Platform administrators and Supreme Owner bypass maintenance mode unconditionally.
 */
export async function maintenanceGate(req: Request, res: Response, next: NextFunction) {
  try {
    const isMaintenance = await getMaintenanceMode();
    if (!isMaintenance) {
      return next();
    }

    // Check if authenticated user is admin/owner
    if (isOwnerEmail(req.user?.email)) {
      return next();
    }

    return res.status(503).json({
      error: 'MAINTENANCE_MODE',
      message: 'System is currently undergoing scheduled maintenance. Please check back shortly.',
    });
  } catch (err: any) {
    console.warn('[maintenanceGate] Error verifying maintenance mode:', err?.message);
    return next();
  }
}
