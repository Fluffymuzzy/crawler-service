import { createHash } from 'crypto';

export function calculateChecksum(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
