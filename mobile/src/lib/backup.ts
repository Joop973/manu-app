import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { uid } from './id';

/**
 * Phase 5 — Voll-Backup ZUM TEILEN.
 *
 * Format: JSON, optional mit Passwort verschlüsselt.
 * Verschlüsselung: leichtes XOR mit SHA-256-abgeleitetem Stream — reicht
 * gegen neugierige Blicke, ist KEIN AES. Für echte Krypto bitte externes
 * Tool benutzen.
 */

interface BackupBundle {
  version: 1;
  createdAt: string;
  app: 'manu-imperial-finance';
  storeKey: string;
  data: unknown;
}

export async function createBackup(input: {
  storeKey: string;
  data: unknown;
  password?: string;
}): Promise<string> {
  const { storeKey, data, password } = input;
  const bundle: BackupBundle = {
    version: 1,
    createdAt: new Date().toISOString(),
    app: 'manu-imperial-finance',
    storeKey,
    data,
  };
  const json = JSON.stringify(bundle);
  let payload = json;
  let header = 'PLAIN';

  if (password && password.length >= 4) {
    payload = await encryptString(json, password);
    header = 'ENC1';
  }

  const fileText = `${header}\n${payload}`;
  const path = `${FileSystem.documentDirectory}${uid('backup')}.manubak`;
  await FileSystem.writeAsStringAsync(path, fileText);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
  return path;
}

export async function readBackup(input: {
  uri: string;
  password?: string;
}): Promise<BackupBundle> {
  const raw = await FileSystem.readAsStringAsync(input.uri);
  const newlineIdx = raw.indexOf('\n');
  if (newlineIdx === -1) throw new Error('Ungültiges Backup-Format');
  const header = raw.slice(0, newlineIdx);
  const body = raw.slice(newlineIdx + 1);

  let json: string;
  if (header === 'PLAIN') {
    json = body;
  } else if (header === 'ENC1') {
    if (!input.password) throw new Error('Backup ist verschlüsselt — Passwort fehlt');
    json = await decryptString(body, input.password);
  } else {
    throw new Error(`Unbekannter Backup-Header: ${header}`);
  }

  const bundle = JSON.parse(json) as BackupBundle;
  if (bundle.app !== 'manu-imperial-finance') {
    throw new Error('Backup gehört nicht zu Manu Imperial Finance');
  }
  return bundle;
}

async function deriveStream(password: string, length: number): Promise<Uint8Array> {
  const out = new Uint8Array(length);
  let written = 0;
  let counter = 0;
  while (written < length) {
    const seed = `${password}::${counter}`;
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, seed);
    for (let i = 0; i < hash.length && written < length; i += 2) {
      out[written++] = parseInt(hash.substring(i, i + 2), 16);
    }
    counter += 1;
  }
  return out;
}

async function encryptString(plain: string, password: string): Promise<string> {
  const bytes = new TextEncoder().encode(plain);
  const stream = await deriveStream(password, bytes.length);
  const xored = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) xored[i] = bytes[i] ^ stream[i];
  return toBase64(xored);
}

async function decryptString(b64: string, password: string): Promise<string> {
  const bytes = fromBase64(b64);
  const stream = await deriveStream(password, bytes.length);
  const xored = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) xored[i] = bytes[i] ^ stream[i];
  return new TextDecoder().decode(xored);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  // @ts-ignore — globalThis.btoa existiert in Hermes
  return typeof btoa === 'function' ? btoa(binary) : (require('buffer') as { Buffer: { from(s: string, e: string): { toString(t: string): string } } }).Buffer.from(binary, 'binary').toString('base64');
}

function fromBase64(b64: string): Uint8Array {
  // @ts-ignore — globalThis.atob existiert in Hermes
  const binary = typeof atob === 'function' ? atob(b64) : (require('buffer') as { Buffer: { from(s: string, e: string): { toString(t: string): string } } }).Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
