import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { AuthenticatedRequest, JwtPayload } from '../types';
import type { UserRole } from '../models/User';

function makeError(message: string, statusCode: number): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

/**
 * Verifies the `Authorization: Bearer <token>` header and attaches
 * the decoded payload to `req.user`. Returns 401 on any failure.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authReq = req as AuthenticatedRequest;
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(makeError('Missing or malformed Authorization header', 401));
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    authReq.user = payload;
    next();
  } catch {
    next(makeError('Invalid or expired token', 401));
  }
}

/**
 * RBAC guard — must be used after `authenticate`.
 * Returns 403 if the authenticated user does not have one of the required roles.
 */
export function requireRole(
  ...roles: UserRole[]
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      return next(makeError('Unauthenticated', 401));
    }

    if (!roles.includes(authReq.user.role)) {
      return next(makeError('Insufficient permissions', 403));
    }

    next();
  };
}
