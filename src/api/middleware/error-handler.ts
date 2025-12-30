import type { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { z } from 'zod';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error(
    {
      err,
      method: req.method,
      url: req.url,
      body: JSON.stringify(req.body),
      params: req.params,
      query: req.query,
    },
    'Request error',
  );

  // Handle Zod validation errors
  if (err instanceof z.ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      details: err.errors,
    });
    return;
  }

  // Handle known errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      error: 'Validation failed',
      message: err.message,
    });
    return;
  }

  // Default error
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
}
