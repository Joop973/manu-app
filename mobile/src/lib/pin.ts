/**
 * F-001: einfaches PIN-Hashing — kein bcrypt im Managed Workflow,
 * darum lightweight Salt + iterierter SHA-ähnlicher Hash.
 * Reicht als Schutz vor neugierigen Blicken; ersetzt KEIN echtes Server-Auth.
 */

function strHash(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
    h = h & 0xffffffff;
  }
  return h >>> 0;
}

export function hashPin(pin: string, salt: string): string {
  let acc = `${salt}::${pin}`;
  for (let i = 0; i < 1500; i += 1) {
    acc = String(strHash(acc + i));
  }
  return `${salt}$${acc}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt] = stored.split('$');
  return hashPin(pin, salt) === stored;
}

export function newSalt(): string {
  return Math.random().toString(36).slice(2, 12);
}
