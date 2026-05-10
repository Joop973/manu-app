import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppStore } from '@/store/useAppStore';
import { palette, radii, spacing, text } from '@/theme';

interface Props {
  title: string;
  body: string;
}

/**
 * F-011 Kontextuelle Hilfe — kleines „?" das ein Modal mit Erklärung öffnet.
 * Wird ausgeblendet, wenn settings.helpHintsEnabled === false.
 */
export function HelpHint({ title, body }: Props) {
  const enabled = useAppStore((s) => s.settings.helpHintsEnabled);
  const [open, setOpen] = useState(false);
  if (!enabled) return null;
  return (
    <>
      <Pressable hitSlop={8} onPress={() => setOpen(true)} style={styles.btn}>
        <Text style={styles.btnText}>?</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={styles.card}>
            <Text style={text.sectionTitle}>{title}</Text>
            <Text style={[text.body, { marginTop: spacing.sm }]}>{body}</Text>
            <Pressable style={styles.dismiss} onPress={() => setOpen(false)}>
              <Text style={[text.bodyBold, { color: palette.imperialGold }]}>Schließen</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: palette.imperialGold,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,175,55,0.10)',
  },
  btnText: { color: palette.imperialGold, fontFamily: 'Lato_900Black', fontSize: 13, lineHeight: 16 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: palette.royalBlue,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.imperialGold,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 360,
  },
  dismiss: {
    marginTop: spacing.md,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
});
