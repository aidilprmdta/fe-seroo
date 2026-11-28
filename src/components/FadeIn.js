// FadeIn — fade + slide halus saat layar pertama dirender, menghormati reduce-motion OS.
import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";

export default function FadeIn({ children, style, distance = 4, duration = 160 }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;

    const run = (reduceMotion) => {
      if (cancelled) return;
      if (reduceMotion) {
        progress.setValue(1);
        return;
      }
      Animated.timing(progress, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    };

    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.())
      .then(run)
      .catch(() => run(true));

    return () => {
      cancelled = true;
      progress.stopAnimation();
    };
  }, [duration, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
