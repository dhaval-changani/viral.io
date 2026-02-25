import { z } from 'zod';

// Create User Validation Schema
export const createUserSchema = z.object({
  body: z.object({
    firstName: z
      .string({
        message: 'First name is required',
      })
      .trim()
      .min(1, 'First name cannot be empty')
      .max(100, 'First name is too long'),
    lastName: z
      .string({
        message: 'Last name is required',
      })
      .trim()
      .min(1, 'Last name cannot be empty')
      .max(100, 'Last name is too long'),
    email: z
      .string({
        message: 'Email is required',
      })
      .trim()
      .toLowerCase()
      .email('Invalid email format'),
    password: z
      .string({
        message: 'Password is required',
      })
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password is too long'),
  }),
});

// Update User Validation Schema
export const updateUserSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format'),
  }),
  body: z.object({
    firstName: z
      .string()
      .trim()
      .min(1, 'First name cannot be empty')
      .max(100, 'First name is too long')
      .optional(),
    lastName: z
      .string()
      .trim()
      .min(1, 'Last name cannot be empty')
      .max(100, 'Last name is too long')
      .optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Invalid email format')
      .optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  }),
});


// Get User by ID Validation Schema
export const getUserByIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format'),
  }),
});

// Delete User Validation Schema
export const deleteUserSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format'),
  }),
});

// List Users Query Validation Schema
export const listUsersSchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .default('1')
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().min(1)),
    limit: z
      .string()
      .optional()
      .default('20')
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().min(1).max(100)),
  }),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type GetUserByIdInput = z.infer<typeof getUserByIdSchema>;
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
