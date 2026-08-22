import { randomBytes } from 'crypto';

export function generateTrackingToken(): string {
  return randomBytes(16).toString('hex');
}
