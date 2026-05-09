import { TextStyle } from 'react-native';
import { palette } from './colors';

export const fonts = {
  display: 'Cinzel_700Bold',
  displayBlack: 'Cinzel_900Black',
  subhead: 'CormorantGaramond_500Medium_Italic',
  body: 'Lato_400Regular',
  bodyBold: 'Lato_700Bold',
  bodyBlack: 'Lato_900Black',
} as const;

export const text = {
  imperialHeadline: {
    fontFamily: fonts.displayBlack,
    fontSize: 28,
    letterSpacing: 2,
    color: palette.imperialGold,
    textTransform: 'uppercase',
  } satisfies TextStyle,
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 1.5,
    color: palette.imperialGold,
    textTransform: 'uppercase',
  } satisfies TextStyle,
  subhead: {
    fontFamily: fonts.subhead,
    fontSize: 16,
    color: palette.marbleWhiteMuted,
    fontStyle: 'italic',
  } satisfies TextStyle,
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: palette.marbleWhite,
  } satisfies TextStyle,
  bodyBold: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: palette.marbleWhite,
  } satisfies TextStyle,
  amountLarge: {
    fontFamily: fonts.bodyBlack,
    fontSize: 36,
    color: palette.marbleWhite,
    letterSpacing: 0.5,
  } satisfies TextStyle,
  amountMedium: {
    fontFamily: fonts.bodyBold,
    fontSize: 20,
    color: palette.marbleWhite,
  } satisfies TextStyle,
  buttonLabel: {
    fontFamily: fonts.bodyBlack,
    fontSize: 14,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#000',
  } satisfies TextStyle,
  caption: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: palette.marbleWhiteMuted,
  } satisfies TextStyle,
};
