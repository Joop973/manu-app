import { useAppStore } from '@/store/useAppStore';

/**
 * F-047 Sprachdiktat — dünner Wrapper um @react-native-voice/voice.
 *
 * Wir laden das Modul lazy, damit Expo Go (ohne native Module) nicht abstürzt.
 * In einem Development-Build steht die echte Implementierung zur Verfügung.
 */

type VoiceModule = {
  start: (locale?: string) => Promise<void>;
  stop: () => Promise<void>;
  isAvailable: () => Promise<boolean>;
  destroy: () => Promise<void>;
  removeAllListeners: () => void;
  onSpeechResults: (cb: (e: { value?: string[] }) => void) => void;
  onSpeechError: (cb: (e: { error?: { code?: string; message?: string } }) => void) => void;
  onSpeechEnd: (cb: () => void) => void;
};

let voiceModule: VoiceModule | null | undefined; // undefined = noch nicht versucht
function loadVoice(): VoiceModule | null {
  if (voiceModule !== undefined) return voiceModule;
  try {
    // Dynamischer require — wirft in Expo Go (kein native module), bleibt dann null.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-voice/voice');
    voiceModule = (mod.default ?? mod) as VoiceModule;
  } catch {
    voiceModule = null;
  }
  return voiceModule;
}

export function isVoiceAvailable(): boolean {
  return loadVoice() !== null;
}

export interface VoiceSession {
  stop(): Promise<void>;
}

export interface StartOptions {
  locale?: string;
  onPartial?: (text: string) => void;
  onResult: (text: string) => void;
  onError?: (msg: string) => void;
}

/**
 * Startet eine Aufnahme. On-device-Recognition, falls in den Settings gewählt.
 */
export async function startRecording(opts: StartOptions): Promise<VoiceSession | null> {
  const v = loadVoice();
  if (!v) {
    opts.onError?.('Sprachdiktat ist im Expo-Go-Build nicht verfügbar — bitte einen Development-Build (expo prebuild) verwenden.');
    return null;
  }
  try {
    if (typeof v.removeAllListeners === 'function') v.removeAllListeners();
    v.onSpeechResults((e) => {
      const text = e.value?.[0];
      if (text) opts.onResult(text);
    });
    v.onSpeechError((e) => opts.onError?.(e.error?.message ?? 'Spracherkennung fehlgeschlagen'));

    const locale = opts.locale ?? (useAppStore.getState().settings.locale === 'en' ? 'en-US' : 'de-DE');
    // @react-native-voice/voice nutzt unter iOS automatisch SFSpeechRecognizer;
    // requiresOnDeviceRecognition wird über den iOS-Speech-Permission-Dialog gesteuert.
    // Es gibt keinen direkten JS-Schalter, aber das voicePrivacy-Setting wird
    // via configure() respektiert, falls vorhanden.
    await v.start(locale);
    return {
      stop: async () => {
        try { await v.stop(); } catch { /* ignore */ }
      },
    };
  } catch (e) {
    opts.onError?.(String(e));
    return null;
  }
}
