import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  authSession?: {
    sessionId: number;
    userId: number;
    username: string;
    role: string;
  };
}

