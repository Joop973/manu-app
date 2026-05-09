/**
 * F-020: Mini-Taschenrechner für das Betragsfeld.
 * Akzeptiert Eingaben wie "450+120", "1200-85,50", "12*3,5".
 * Komma und Punkt sind als Dezimaltrenner gleichwertig.
 */

const TOKEN_RE = /\s*([+\-*/])\s*/;

export function evaluateExpression(input: string): number | null {
  if (!input) return null;
  const normalized = input.replace(/\s/g, '').replace(/,/g, '.');

  if (!/^-?\d/.test(normalized)) return null;
  if (!/[+\-*/]/.test(normalized)) {
    const single = Number(normalized);
    return Number.isFinite(single) ? single : null;
  }

  const tokens = normalized
    .split(TOKEN_RE)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return null;

  let acc = Number(tokens[0]);
  if (!Number.isFinite(acc)) return null;

  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const next = Number(tokens[i + 1]);
    if (!Number.isFinite(next)) return null;
    switch (op) {
      case '+':
        acc += next;
        break;
      case '-':
        acc -= next;
        break;
      case '*':
        acc *= next;
        break;
      case '/':
        if (next === 0) return null;
        acc /= next;
        break;
      default:
        return null;
    }
  }
  return Math.round(acc * 100) / 100;
}

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}
