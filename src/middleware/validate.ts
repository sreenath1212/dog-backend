import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

/**
 * Generic Zod validation middleware factory.
 * Validates request body, query params, or URL params against a Zod schema.
 * Returns 400 with field-level error details on failure.
 *
 * Usage: router.post('/route', validate(MySchema), controller)
 */
export function validate(schema: AnyZodObject, source: 'body' | 'query' | 'params' = 'body') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req[source];
      const parsed = await schema.parseAsync(data);
      // Replace the source data with the parsed (type-coerced) data
      (req as any)[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        // Return field-level errors — safe to send to client (no internal details)
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          fields: err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(err);
    }
  };
}
