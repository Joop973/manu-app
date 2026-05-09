import { Category } from '@/types';

export const builtinCategories: Category[] = [
  { id: 'cat-strom', emoji: '⚡', label: 'Strom', builtin: true, fixedCost: true },
  { id: 'cat-wasser', emoji: '💧', label: 'Wasser', builtin: true, fixedCost: true },
  { id: 'cat-hausgeld', emoji: '🏠', label: 'Hausgeld', builtin: true, fixedCost: true },
  { id: 'cat-reparatur', emoji: '🔧', label: 'Reparatur', builtin: true },
  { id: 'cat-gez', emoji: '📺', label: 'GEZ', builtin: true, fixedCost: true },
  { id: 'cat-internet', emoji: '🌐', label: 'Internet', builtin: true, fixedCost: true },
  { id: 'cat-versicherung', emoji: '🛡', label: 'Versicherung', builtin: true, fixedCost: true },
  { id: 'cat-steuer', emoji: '📄', label: 'Steuer', builtin: true },
  { id: 'cat-miete', emoji: '💰', label: 'Miete', builtin: true },
  { id: 'cat-kredit', emoji: '🏗', label: 'Kredit', builtin: true, fixedCost: true },
  { id: 'cat-reinigung', emoji: '🧹', label: 'Reinigung', builtin: true },
  { id: 'cat-garten', emoji: '🌿', label: 'Garten', builtin: true },
  { id: 'cat-sonstiges', emoji: '✨', label: 'Sonstiges', builtin: true },
];

export const FIXED_COST_CATEGORY_IDS = new Set(
  builtinCategories.filter((c) => c.fixedCost).map((c) => c.id),
);
