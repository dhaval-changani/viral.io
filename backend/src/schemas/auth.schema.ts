import { z } from 'zod';

// Login Validation Schema
export const loginSchema = z.object({
  body: z.object({
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
      .min(1, 'Password is required'),
  }),
});

export type LoginInput = z.infer<typeof loginSchema>;
