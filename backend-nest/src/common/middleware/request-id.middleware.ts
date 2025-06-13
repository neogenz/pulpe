import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Generate a unique request ID if not provided
    const requestId = req.headers['x-request-id'] as string || randomUUID();
    
    // Set the request ID in the request headers
    req.headers['x-request-id'] = requestId;
    
    // Also set it in the response headers for tracing
    res.setHeader('x-request-id', requestId);
    
    next();
  }
}