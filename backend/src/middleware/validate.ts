import type { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod';

/**
 * Middleware to validate request data against a Zod schema
 * Validates req.body, req.query, and req.params
 */
export function validate(schema: ZodType) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = (await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })) as { body?: any; query?: any; params?: any };

      // Replace request objects with validated data
      if (validated.body !== undefined) {
        req.body = validated.body;
      }

      next();
    } catch (error) {
      console.log(`🚀 | validate.ts:9 | validate | error|`, error);

      if (error instanceof ZodError) {
        const errors = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        console.log(`🚀 | validate.ts:31 | validate | errors|`, errors)

        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors,
        });
        return;
      }

      next(error);
    }
  };
}
