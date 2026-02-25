import type { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service';
import type { ApiResponse, CreateUserDto, UpdateUserDto, PaginatedResponse } from '../types';
import type { UserPublic } from '../types';

export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto: CreateUserDto = req.body;
    const user = await userService.createUser(dto);

    const response: ApiResponse<UserPublic> = {
      success: true,
      data: user.toJSON() as unknown as UserPublic,
      message: 'User created successfully',
    };

    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
}

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));

    const { users, pagination } = await userService.listUsers(page, limit);

    const response: PaginatedResponse<UserPublic> = {
      success: true,
      data: users.map((u) => u.toJSON() as unknown as UserPublic),
      pagination,
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userService.getUserById(req.params.id);

    const response: ApiResponse<UserPublic> = {
      success: true,
      data: user.toJSON() as unknown as UserPublic,
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto: UpdateUserDto = req.body;
    const user = await userService.updateUser(req.params.id, dto);

    const response: ApiResponse<UserPublic> = {
      success: true,
      data: user.toJSON() as unknown as UserPublic,
      message: 'User updated successfully',
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await userService.deleteUser(req.params.id);

    const response: ApiResponse = {
      success: true,
      message: 'User deleted successfully',
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}
