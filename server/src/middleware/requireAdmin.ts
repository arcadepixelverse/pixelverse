import { Request, Response, NextFunction } from 'express';
import { isOwnerEmail } from '../lib/owner';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user || !user.email) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required. User is not authenticated.',
    });
  }

  if (!isOwnerEmail(user.email)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required. Your account is not authorized.',
    });
  }

  next();
}
