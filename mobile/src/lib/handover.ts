import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { HandoverProtocol, Property, Tenant } from '@/types';
import { uid } from './id';

/**
 * F-044 Übergabeprotokoll — speichert Fotos im documentDirectory/handovers/
 * und rendert PDF.
 */

const HANDOVER_DIR = FileSystem.documentDirectory + 'handovers/';

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(HANDOVER_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(HANDOVER_DIR, { intermediates: true });
}

export async function saveHandoverPhoto(sourceUri: string): Promise<string> {
  await ensureDir();
  const target = `${HANDOVER_DIR}${uid('hov')}.jpg`;
  await FileSystem.copyAsync({ from: sourceUri, to: target });
  return target;
}

export async function exportHandoverPdf(input: {
  protocol: HandoverProtocol;
  property?: Property;
  tenant?: Tenant;
}): Promise<string> {
  const { protocol, property, tenant } = input;
  const roomsHtml = await Promise.all(
    protocol.rooms.map(async (r) => {
      const photos = await Promise.all(
        r.photoUris.map(async (uri) => {
          try {
            const data = await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            return `<img src="data:image/jpeg;base64,${data}" style="max-width: 200px; margin: 4px; border: 1px solid #e0d59f;" />`;
          } catch {
            return '';
          }
        }),
      );
      const meterHtml = r.meterReadings?.length
        ? `<p><b>Zählerstände:</b> ${r.meterReadings
            .map((m) => `${m.type}: ${m.value} ${m.unit ?? ''}`)
            .join(' · ')}</p>`
        : '';
      const defectsHtml = r.defects.length
        ? `<ul>${r.defects.map((d) => `<li>${d}</li>`).join('')}</ul>`
        : '<p><i>Keine Mängel</i></p>';
      return `<section>
        <h3>${r.name}</h3>
        <p><b>Zustand:</b> ${r.condition || '—'}</p>
        ${meterHtml}
        <h4>Mängel</h4>
        ${defectsHtml}
        ${photos.join('')}
      </section>`;
    }),
  );

  const keysHtml = protocol.keys
    .map((k) => `<li>${k.count}× ${k.type}</li>`)
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8" />
    <style>
      body { font-family: -apple-system, sans-serif; padding: 28px; color: #1a1a1a; }
      h1 { color: #8a6d1d; }
      h3 { color: #8a6d1d; margin-top: 18px; }
      h4 { font-size: 12px; }
      section { border-top: 1px solid #e0d59f; padding-top: 8px; margin-top: 12px; }
      p, li { font-size: 12px; }
    </style></head>
    <body>
      <h1>Übergabeprotokoll — ${protocol.kind === 'einzug' ? 'Einzug' : 'Auszug'}</h1>
      <p><b>Objekt:</b> ${property?.name ?? '—'} (${property?.address ?? ''})</p>
      <p><b>Mieter:</b> ${tenant?.name ?? '—'}</p>
      <p><b>Datum:</b> ${protocol.date}</p>

      <h3>Räume</h3>
      ${roomsHtml.join('')}

      <h3>Schlüsselübergabe</h3>
      <ul>${keysHtml || '<li><i>Keine Schlüssel dokumentiert</i></li>'}</ul>

      ${protocol.notes ? `<h3>Notizen</h3><p>${protocol.notes}</p>` : ''}

      <p style="margin-top: 30px; font-size: 10px; color: #888;">
        Manu Imperial Finance · Übergabeprotokoll · ${new Date().toLocaleString('de-DE')}
      </p>
    </body></html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
  return uri;
}
