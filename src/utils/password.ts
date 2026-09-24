import bcrypt from 'bcrypt';
import { env } from '../config/env';

function rounds(): number {
  return env.NODE_ENV === 'test' ? 4 : 12;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, rounds());
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
