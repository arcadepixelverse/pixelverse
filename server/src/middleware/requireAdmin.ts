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

  const configuredAdmin = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const userEmail = user.email.trim().toLowerCase();

  const isAuthorized =
    (configuredAdmin && userEmail === configuredAdmin) ||
    DEFAULT_ADMIN_EMAILS.includes(userEmail);

  if (!isAuthorized) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required. Your account is not authorized.',
    });
  }

  next();
}
