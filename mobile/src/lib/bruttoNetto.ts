/**
 * F-121 Brutto-Netto-Rechner — vereinfachte deutsche Kalkulation 2026.
 * KEINE rechtsverbindliche Aussage — nur grobe Schätzung.
 */

export type TaxClass = 1 | 2 | 3 | 4 | 5 | 6;

export interface BruttoNettoInput {
  monthlyGross: number;
  taxClass: TaxClass;
  childrenAllowance: number; // Kinderfreibeträge (z.B. 0, 0.5, 1, 1.5, 2)
  churchTaxPercent: number; // 0, 8 oder 9
  privateHealthInsurance: boolean;
  state: 'BW' | 'BY' | 'NRW' | 'andere';
}

export interface BruttoNettoResult {
  brutto: number;
  einkommensteuer: number;
  solidaritaetszuschlag: number;
  kirchensteuer: number;
  rentenversicherung: number;
  arbeitslosenversicherung: number;
  krankenversicherung: number;
  pflegeversicherung: number;
  abzuegeGesamt: number;
  netto: number;
  effektiveSteuerquote: number;
}

const GRUNDFREIBETRAG_2026 = 12096; // jährlich (Schätzung)
const KINDERFREIBETRAG_2026 = 9540;

// Sehr vereinfachter Tarif (linear-progressiv) — reicht für eine Hausnummer
function einkommensteuerJahr(zvE: number): number {
  if (zvE <= GRUNDFREIBETRAG_2026) return 0;
  if (zvE <= 17_005) {
    const y = (zvE - GRUNDFREIBETRAG_2026) / 10_000;
    return (932.3 * y + 1400) * y;
  }
  if (zvE <= 66_760) {
    const z = (zvE - 17_005) / 10_000;
    return (176.64 * z + 2397) * z + 1015.13;
  }
  if (zvE <= 277_825) {
    return 0.42 * zvE - 10_911.92;
  }
  return 0.45 * zvE - 19_246.67;
}

export function computeBruttoNetto(i: BruttoNettoInput): BruttoNettoResult {
  const brutto = i.monthlyGross;
  const annual = brutto * 12;

  // Sozialversicherungs-Beitragssätze 2026 (geschätzt)
  const rvSatz = 0.093;
  const avSatz = 0.013;
  const kvSatz = i.privateHealthInsurance ? 0.04 : 0.0825; // Schätzung inkl. Zusatzbeitrag
  const pvSatz = 0.018 + (i.childrenAllowance >= 0.5 ? 0 : 0.006);

  const rv = brutto * rvSatz;
  const av = brutto * avSatz;
  const kv = brutto * kvSatz;
  const pv = brutto * pvSatz;

  const sozial = rv + av + kv + pv;

  // Lohnsteuer — vereinfacht: zvE = annual − Werbungskosten(1230) − Vorsorgepauschale (12% Sozialvers., gekappt)
  const wkPauschale = 1230;
  const vorsorgePauschale = Math.min(annual * 0.12, 5000);
  const childrenAllow = KINDERFREIBETRAG_2026 * i.childrenAllowance;
  const splitting = i.taxClass === 3;
  let zvE = annual - wkPauschale - vorsorgePauschale - childrenAllow;
  if (i.taxClass === 5 || i.taxClass === 6) zvE = annual - wkPauschale - vorsorgePauschale; // Klasse 5/6 keine Freibeträge

  let lohnsteuerJahr = einkommensteuerJahr(splitting ? zvE / 2 : zvE);
  if (splitting) lohnsteuerJahr *= 2;
  // Klasse 5/6: pauschal höhere Belastung
  if (i.taxClass === 5) lohnsteuerJahr *= 1.4;
  if (i.taxClass === 6) lohnsteuerJahr *= 1.6;

  const lohnsteuerMonat = Math.max(0, lohnsteuerJahr / 12);
  const soliMonat = lohnsteuerMonat > 1340 ? lohnsteuerMonat * 0.055 : 0;
  const kirchenMonat = i.churchTaxPercent > 0 ? lohnsteuerMonat * (i.churchTaxPercent / 100) : 0;

  const abzuege = lohnsteuerMonat + soliMonat + kirchenMonat + sozial;
  const netto = brutto - abzuege;

  return {
    brutto,
    einkommensteuer: lohnsteuerMonat,
    solidaritaetszuschlag: soliMonat,
    kirchensteuer: kirchenMonat,
    rentenversicherung: rv,
    arbeitslosenversicherung: av,
    krankenversicherung: kv,
    pflegeversicherung: pv,
    abzuegeGesamt: abzuege,
    netto,
    effektiveSteuerquote: brutto > 0 ? abzuege / brutto : 0,
  };
}

// Pauschalbeträge 2026 (Schätzung)
export const PAUSCHALBETRAEGE = {
  arbeitnehmerPauschbetrag: 1230, // Werbungskosten
  sparerPauschbetrag: 1000,
  ausbildungsfreibetrag: 1200,
  alleinerziehende: 4260,
  haushaltsnahDienstleistung: 4000, // 20% von 20.000
  handwerkerleistung: 1200, // 20% von 6.000
};
