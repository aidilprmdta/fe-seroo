// Responsive helper — satu sumber ukuran untuk phone kecil, phone besar, dan tablet.
import { useWindowDimensions } from 'react-native';

export function useResponsive() {
  const { width, height } = useWindowDimensions();

  const isSmallPhone = width < 360;
  const isPhone = width < 600;
  const isTablet = width >= 600;
  const isWide = width >= 900;

  return {
    width,
    height,
    isSmallPhone,
    isPhone,
    isTablet,
    isWide,
    padding: isSmallPhone ? 12 : isPhone ? 16 : 24,
    gap: isSmallPhone ? 8 : isPhone ? 12 : 16,
    cardColumns: isWide ? 4 : isTablet ? 3 : 2,
    modalWidth: isPhone ? '100%' : Math.min(560, Math.round(width * 0.86)),
    modalMaxHeight: isPhone ? '88%' : '80%',
    titleSize: isSmallPhone ? 22 : isPhone ? 24 : 28,
    bodySize: isSmallPhone ? 13 : 14,
  };
}
