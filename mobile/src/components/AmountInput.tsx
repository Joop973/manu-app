import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { evaluateExpression, formatEuro } from '@/lib/calc';
import { palette, radii, spacing, text } from '@/theme';

interface Props {
  value: string;
  onChange: (raw: string, evaluated: number | null) => void;
  type?: 'income' | 'expense';
  autoFocus?: boolean;
  placeholder?: string;
}

/**
 * F-020: Mini-Taschenrechner direkt im Betragsfeld.
 * Live-Vorschau zeigt das Ergebnis von Ausdrücken wie "1200-85,50".
 */
export function AmountInput({ value, onChange, type = 'expense', autoFocus, placeholder = '0,00' }: Props) {
  const evaluated = useMemo(() => evaluateExpression(value), [value]);
  const [focused, setFocused] = useState(false);
  const tint = type === 'income' ? palette.successGreen : palette.dangerRed;
  const showPreview = focused && /[+\-*/]/.test(value) && evaluated !== null;

  return (
    <View>
      <View style={[styles.wrap, { borderColor: focused ? tint : palette.cardBorder }]}>
        <Text style={[text.amountLarge, { color: tint, marginRight: spacing.sm }]}>
          {type === 'income' ? '+' : '−'}
        </Text>
        <TextInput
          autoFocus={autoFocus}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={palette.marbleWhiteMuted}
          keyboardType="numbers-and-punctuation"
          inputMode="decimal"
          style={[text.amountLarge, styles.input]}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (evaluated !== null) {
              onChange(evaluated.toString().replace('.', ','), evaluated);
            }
          }}
          onChangeText={(raw) => onChange(raw, evaluateExpression(raw))}
        />
        <Text style={[text.amountLarge, { color: palette.marbleWhiteMuted }]}>€</Text>
      </View>
      {showPreview && evaluated !== null && (
        <Text style={[text.caption, { textAlign: 'right', marginTop: 4 }]}>
          = {formatEuro(evaluated)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.royalBlue,
    borderWidth: 2,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  input: {
    flex: 1,
    color: palette.marbleWhite,
  },
});
