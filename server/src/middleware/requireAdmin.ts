import { Request, Response, NextFunction } from 'express';

const DEFAULT_ADMIN_EMAILS = [
  'pritisinghmgs@gmail.com',
  'arcade.pixelverse@gmail.com',
];

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user || !user.email) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required. User is not authenticated.',
    });
  }

  const rawAdminEnv = process.env.ADMIN_EMAIL || '';
  const adminEmailsFromEnv = rawAdminEnv
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const userEmail = user.email.trim().toLowerCase();

  const isAuthorized =
    adminEmailsFromEnv.includes(userEmail) ||
    DEFAULT_ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(userEmail);

  if (!isAuthorized) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required. Your account is not authorized.',
    });
  }

  next();
}
