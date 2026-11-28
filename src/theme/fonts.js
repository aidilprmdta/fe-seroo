// Font resmi Seroo dari Figma: Inter (UI) + Barlow Condensed (display/wordmark).
// Menggunakan fallback jika font belum ter-load agar aplikasi tidak macet/stuck di loading screen.
let useExpoFonts = null;
let Inter_400Regular = null;
let Inter_500Medium = null;
let Inter_600SemiBold = null;
let Inter_700Bold = null;
let BarlowCondensed_700Bold = null;
let BarlowCondensed_700Bold_Italic = null;

try {
  useExpoFonts = require('expo-font').useFonts;
  // Impor per berat font, bukan index paket: index menarik seluruh 18 varian TTF ke bundle.
  Inter_400Regular = require('@expo-google-fonts/inter/400Regular').Inter_400Regular;
  Inter_500Medium = require('@expo-google-fonts/inter/500Medium').Inter_500Medium;
  Inter_600SemiBold = require('@expo-google-fonts/inter/600SemiBold').Inter_600SemiBold;
  Inter_700Bold = require('@expo-google-fonts/inter/700Bold').Inter_700Bold;
  BarlowCondensed_700Bold =
    require('@expo-google-fonts/barlow-condensed/700Bold').BarlowCondensed_700Bold;
  BarlowCondensed_700Bold_Italic =
    require('@expo-google-fonts/barlow-condensed/700Bold_Italic').BarlowCondensed_700Bold_Italic;
} catch {
  // Font packages optional / fallback ke system font
}

export const FONT = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  display: 'BarlowCondensed_700Bold',
  displayItalic: 'BarlowCondensed_700Bold_Italic',
};

export function useSerooFonts() {
  if (
    typeof useExpoFonts !== 'function' ||
    !Inter_400Regular ||
    !BarlowCondensed_700Bold
  ) {
    return [true, null];
  }

  try {
    const result = useExpoFonts({
      [FONT.regular]: Inter_400Regular,
      [FONT.medium]: Inter_500Medium,
      [FONT.semibold]: Inter_600SemiBold,
      [FONT.bold]: Inter_700Bold,
      [FONT.display]: BarlowCondensed_700Bold,
      [FONT.displayItalic]: BarlowCondensed_700Bold_Italic,
    });
    return result;
  } catch {
    return [true, null];
  }
}

