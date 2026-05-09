import { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { palette, radii, spacing, text } from '@/theme';

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={[text.sectionTitle, styles.label]}>{label}</Text>
      {children}
      {hint ? <Text style={[text.caption, { marginTop: 4 }]}>{hint}</Text> : null}
    </View>
  );
}

interface TextFieldProps extends TextInputProps {
  multiline?: boolean;
}

export function TextField({ multiline, style, ...rest }: TextFieldProps) {
  return (
    <TextInput
      placeholderTextColor={palette.marbleWhiteMuted}
      multiline={multiline}
      style={[styles.input, multiline && { minHeight: 80, textAlignVertical: 'top' }, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { fontSize: 12 },
  input: {
    backgroundColor: palette.royalBlue,
    color: palette.marbleWhite,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    fontFamily: 'Lato_400Regular',
    fontSize: 16,
  },
});
