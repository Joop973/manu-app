import { useAppStore } from '@/store/useAppStore';
import { Locale } from '@/types';

/**
 * Phase 5 — Mehrsprachigkeit DE/EN.
 * Schlanker eigener i18n-Layer ohne externe Pakete.
 */

type Dict = Record<string, string>;

const DE: Dict = {
  'common.cancel': 'Abbrechen',
  'common.save': 'Speichern',
  'common.delete': 'Löschen',
  'common.confirm': 'Bestätigen',
  'common.share': 'Teilen',
  'common.back': 'Zurück',
  'common.search': 'Suchen',
  'common.export': 'Exportieren',
  'common.import': 'Importieren',
  'common.empty': 'Nichts vorhanden',
  'common.add': 'Hinzufügen',
  'common.edit': 'Bearbeiten',
  'common.restore': 'Wiederherstellen',
  'common.permanently': 'Endgültig löschen',
  'tab.dashboard': 'Hauptsaal',
  'tab.bookings': 'Buchungen',
  'tab.tresore': 'Tresore',
  'tab.admin': 'Verwaltung',
  'tab.settings': 'Einstellungen',
  'settings.security': '🔒 Sicherheit',
  'settings.lookFeel': '🎰 Casino-Feeling',
  'settings.fontSize': '🔡 Schriftgröße',
  'settings.theme': '🎨 Thema',
  'settings.theme.dark': 'Dunkel',
  'settings.theme.light': 'Hell',
  'settings.theme.system': 'System',
  'settings.language': '🌐 Sprache',
  'settings.language.de': 'Deutsch',
  'settings.language.en': 'English',
  'settings.autoLock': '⏲ Auto-Lock',
  'settings.autoLock.off': 'Aus',
  'settings.backup': '📦 Backup',
  'settings.backup.create': 'Backup erstellen',
  'settings.backup.restore': 'Backup wiederherstellen',
  'settings.trash': '🗑 Papierkorb',
  'trash.title': 'Papierkorb',
  'trash.description': 'Gelöschte Einträge bleiben 30 Tage aufgehoben.',
  'trash.empty': 'Papierkorb ist leer',
  'trash.deletedAt': 'Gelöscht am',
  'bulk.title': 'Auswahl',
  'bulk.selected': '{n} ausgewählt',
  'bulk.deleteAll': 'Alle löschen',
  'bulk.assignProperty': 'Objekt zuweisen',
  'bulk.assignCategory': 'Kategorie zuweisen',
};

const EN: Dict = {
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.confirm': 'Confirm',
  'common.share': 'Share',
  'common.back': 'Back',
  'common.search': 'Search',
  'common.export': 'Export',
  'common.import': 'Import',
  'common.empty': 'Nothing here',
  'common.add': 'Add',
  'common.edit': 'Edit',
  'common.restore': 'Restore',
  'common.permanently': 'Delete permanently',
  'tab.dashboard': 'Dashboard',
  'tab.bookings': 'Bookings',
  'tab.tresore': 'Vaults',
  'tab.admin': 'Admin',
  'tab.settings': 'Settings',
  'settings.security': '🔒 Security',
  'settings.lookFeel': '🎰 Casino feel',
  'settings.fontSize': '🔡 Font size',
  'settings.theme': '🎨 Theme',
  'settings.theme.dark': 'Dark',
  'settings.theme.light': 'Light',
  'settings.theme.system': 'System',
  'settings.language': '🌐 Language',
  'settings.language.de': 'Deutsch',
  'settings.language.en': 'English',
  'settings.autoLock': '⏲ Auto-lock',
  'settings.autoLock.off': 'Off',
  'settings.backup': '📦 Backup',
  'settings.backup.create': 'Create backup',
  'settings.backup.restore': 'Restore backup',
  'settings.trash': '🗑 Trash',
  'trash.title': 'Trash',
  'trash.description': 'Deleted entries are kept for 30 days.',
  'trash.empty': 'Trash is empty',
  'trash.deletedAt': 'Deleted at',
  'bulk.title': 'Selection',
  'bulk.selected': '{n} selected',
  'bulk.deleteAll': 'Delete all',
  'bulk.assignProperty': 'Assign property',
  'bulk.assignCategory': 'Assign category',
};

const DICTS: Record<Locale, Dict> = { de: DE, en: EN };

export function t(key: string, params?: Record<string, string | number>): string {
  const locale = useAppStore.getState().settings.locale;
  const dict = DICTS[locale] ?? DE;
  let s = dict[key] ?? DE[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v));
  return s;
}

export function useT(): (key: string, params?: Record<string, string | number>) => string {
  // Subskribiert auf locale, damit Re-Render bei Sprachwechsel
  const locale = useAppStore((s) => s.settings.locale);
  return (key, params) => {
    const dict = DICTS[locale] ?? DE;
    let s = dict[key] ?? DE[key] ?? key;
    if (params) for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v));
    return s;
  };
}
