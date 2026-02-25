import bcrypt from 'bcryptjs';
import { User, IUser } from '../models/User';
import type { CreateUserDto, UpdateUserDto, PaginationMeta } from '../types';

const SALT_ROUNDS = 12;

function makeError(message: string, statusCode: number): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

export async function createUser(dto: CreateUserDto): Promise<IUser> {
  const existing = await User.findOne({ email: dto.email.toLowerCase() });
  if (existing) {
    throw makeError('Email already in use', 409);
  }

  const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

  const user = await User.create({
    firstName: dto.firstName,
    lastName: dto.lastName,
    email: dto.email,
    passwordHash,
  });

  return user;
}

export async function listUsers(
  page: number,
  limit: number,
): Promise<{ users: IUser[]; pagination: PaginationMeta }> {
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find().skip(skip).limit(limit).sort({ createdAt: -1 }),
    User.countDocuments(),
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getUserById(id: string): Promise<IUser> {
  const user = await User.findById(id);
  if (!user) {
    throw makeError('User not found', 404);
  }
  return user;
}

export async function updateUser(id: string, dto: UpdateUserDto): Promise<IUser> {
  if (dto.email) {
    const existing = await User.findOne({ email: dto.email.toLowerCase(), _id: { $ne: id } });
    if (existing) {
      throw makeError('Email already in use', 409);
    }
  }

  const user = await User.findByIdAndUpdate(id, dto, { new: true, runValidators: true });
  if (!user) {
    throw makeError('User not found', 404);
  }
  return user;
}

export async function deleteUser(id: string): Promise<void> {
  const user = await User.findByIdAndDelete(id);
  if (!user) {
    throw makeError('User not found', 404);
  }
}

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<IUser> {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) {
    throw makeError('Invalid email or password', 401);
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw makeError('Invalid email or password', 401);
  }

  return user;
}
