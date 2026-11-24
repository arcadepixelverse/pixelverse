import { Request, Response, NextFunction } from 'express';
import { getMaintenanceMode } from '../lib/gameStatus';

const DEFAULT_ADMIN_EMAILS = [
  'pritisinghmgs@gmail.com',
  'arcade.pixelverse@gmail.com',
];

/**
 * Universal Maintenance Mode Gate
 * Blocks non-admin gameplay requests with 503 MAINTENANCE_MODE when active.
 * Platform administrators bypass maintenance mode unconditionally.
 */
export async function maintenanceGate(req: Request, res: Response, next: NextFunction) {
  try {
    const isMaintenance = await getMaintenanceMode();
    if (!isMaintenance) {
      return next();
    }

    // Check if authenticated user is admin
    const userEmail = req.user?.email?.trim().toLowerCase();
    if (userEmail) {
      const rawAdminEnv = process.env.ADMIN_EMAIL || '';
      const adminEmailsFromEnv = rawAdminEnv
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      const isAuthorized =
        adminEmailsFromEnv.includes(userEmail) ||
        DEFAULT_ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(userEmail);

      if (isAuthorized) {
        return next();
      }
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
