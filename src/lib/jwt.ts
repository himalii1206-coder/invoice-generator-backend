import jwt from 'jsonwebtoken';
import type { JwtPayload } from '@/types';

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET ?? 'access-secret-change-in-production';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET ?? 'refresh-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export function generateAccessToken(userId: string, email: string): string {
  return jwt.sign(
    { userId, email, type: 'access' } satisfies Omit<JwtPayload, 'iat' | 'exp'>,
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY },
  );
}

export function generateRefreshToken(userId: string, email: string): string {
  return jwt.sign(
    { userId, email, type: 'refresh' } satisfies Omit<JwtPayload, 'iat' | 'exp'>,
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY },
  );
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_TOKEN_SECRET) as JwtPayload;
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch {
    return null;
  }
}
