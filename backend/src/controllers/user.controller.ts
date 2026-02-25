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
    // After validation middleware, query params are transformed to numbers
    const page = req.query.page as unknown as number;
    console.log(`🚀 | user.controller.ts:27 | listUsers | page|`, page)
    const limit = req.query.limit as unknown as number;
    console.log(`🚀 | user.controller.ts:29 | listUsers | limit|`, limit)

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
    const user = await userService.getUserById(req.params.id as string);

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
    const user = await userService.updateUser(req.params.id as string, dto);

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
    await userService.deleteUser(req.params.id as string);

    const response: ApiResponse = {
      success: true,
      message: 'User deleted successfully',
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}
