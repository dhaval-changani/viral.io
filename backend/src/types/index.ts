import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../models/User';

// Standard API response envelope
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  stack?: string;
}

// Typed Express handler
export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

// Pagination metadata
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

// User DTOs
export interface CreateUserDto {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface UserPublic {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  token: string;
  user: UserPublic;
}

// JWT payload stored in the token
export interface JwtPayload {
  sub: string; // user._id
  role: UserRole;
}

// Express Request extended with authenticated user
export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
