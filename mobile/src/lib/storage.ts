import * as FileSystem from 'expo-file-system';

import { uid } from './id';

/**
 * Lokale Datei-Ablage für Belege und Dokumente. Liegt im documentDirectory
 * und überlebt App-Restarts. Wird zentral aufgerufen, damit niemand direkt
 * mit dem FS arbeitet.
 */
const RECEIPT_DIR = FileSystem.documentDirectory + 'receipts/';
const DOCUMENT_DIR = FileSystem.documentDirectory + 'documents/';
const READING_DIR = FileSystem.documentDirectory + 'readings/';

async function ensureDir(dir: string) {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

export async function saveReceiptFile(sourceUri: string, originalName: string): Promise<{ uri: string; size: number }> {
  await ensureDir(RECEIPT_DIR);
  const ext = originalName.includes('.') ? originalName.slice(originalName.lastIndexOf('.')) : '';
  const target = `${RECEIPT_DIR}${uid('rec')}${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: target });
  const info = await FileSystem.getInfoAsync(target);
  return { uri: target, size: info.exists ? info.size ?? 0 : 0 };
}

export async function saveDocumentFile(sourceUri: string, originalName: string): Promise<{ uri: string; size: number }> {
  await ensureDir(DOCUMENT_DIR);
  const ext = originalName.includes('.') ? originalName.slice(originalName.lastIndexOf('.')) : '';
  const target = `${DOCUMENT_DIR}${uid('doc')}${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: target });
  const info = await FileSystem.getInfoAsync(target);
  return { uri: target, size: info.exists ? info.size ?? 0 : 0 };
}

export async function saveReadingPhoto(sourceUri: string): Promise<string> {
  await ensureDir(READING_DIR);
  const target = `${READING_DIR}${uid('rd')}.jpg`;
  await FileSystem.copyAsync({ from: sourceUri, to: target });
  return target;
}

export async function deleteFile(uri: string) {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // schweigt — Datei war evtl. schon weg
  }
}

/**
 * Versucht, Text aus einer lokalen Datei zu lesen.
 * - Für *.txt: direkter Read
 * - Für Bilder: ML-Kit-OCR (on-device, falls verfügbar)
 * - Für PDFs: leerer String (PDF-Parser kommt in einer späteren Phase)
 */
export async function readExtractableText(uri: string, filename: string): Promise<string> {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.txt')) {
    try {
      return await FileSystem.readAsStringAsync(uri);
    } catch {
      return '';
    }
  }
  // Bilder via ML-Kit erkennen (Phase 7)
  if (/\.(jpe?g|png|webp|heic)$/i.test(lower)) {
    return await runMlKitOcr(uri);
  }
  return '';
}

/**
 * ML-Kit-OCR (Phase 7) — lazy load, in Expo Go fällt zurück auf leeren String.
 */
async function runMlKitOcr(uri: string): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-ml-kit/text-recognition');
    const TextRecognition = mod.default ?? mod;
    const result = await TextRecognition.recognize(uri);
    if (typeof result?.text === 'string') return result.text;
    if (Array.isArray(result?.blocks)) {
      return result.blocks
        .map((b: { text?: string }) => b.text ?? '')
        .filter(Boolean)
        .join('\n');
    }
    return '';
  } catch (e) {
    if (__DEV__) console.log('[ML-Kit] nicht verfügbar / Fehler:', e);
    return '';
  }
}
