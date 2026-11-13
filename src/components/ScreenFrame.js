import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/tokens";

export default function ScreenFrame({ children, style }) {
  return (
    <SafeAreaView
      style={[
        { flex: 1, backgroundColor: colors.background },
        style,
      ]}
    >
      {children}
    </SafeAreaView>
  );
}
