import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import * as userService from '../services/user.service';
import type { ApiResponse, LoginDto, LoginResponse, UserPublic, CreateUserDto } from '../types';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto: LoginDto = req.body;
    const user = await userService.verifyCredentials(dto.email, dto.password);

    const token = jwt.sign(
      { sub: user._id.toString(), role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    );

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: {
        token,
        user: user.toJSON() as unknown as UserPublic,
      },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto: CreateUserDto = req.body;
    const user = await userService.createUser(dto);

    const token = jwt.sign(
      { sub: user._id.toString(), role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    );

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: {
        token,
        user: user.toJSON() as unknown as UserPublic,
      },
    };

    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
}
