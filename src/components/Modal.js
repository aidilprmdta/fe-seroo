// Modal — bottom sheet responsif (full-width di HP, sheet terpusat di tablet)
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, spacing, typography, radii } from '../theme/tokens';
import { useResponsive } from '../theme/responsive';

export default function Modal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width,
  maxHeight,
}) {
  const r = useResponsive();
  const progress = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(Boolean(visible));

  useEffect(() => {
    if (visible) setRendered(true);
  }, [visible]);

  useEffect(() => {
    if (!rendered) return undefined;
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 180 : 140,
      easing: visible ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setRendered(false);
    });
    return () => animation.stop();
  }, [progress, rendered, visible]);

  if (!rendered) return null;

  const sheetWidth = width ?? r.modalWidth;
  const sheetMaxHeight = maxHeight ?? r.modalMaxHeight;
  const sheetOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.overlay, { opacity: progress }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <Animated.View
          style={[
            styles.modal,
            { width: sheetWidth, maxHeight: sheetMaxHeight },
            { transform: [{ translateY: sheetOffset }] },
          ]}
        >
          {title ? (
            <View style={styles.header}>
              <Text style={[styles.title, { fontSize: r.titleSize - 2 }]} numberOfLines={1}>
                {title}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.close} hitSlop={8}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentInner}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {children}
          </ScrollView>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.light.overlay,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  keyboardView: {
    width: '100%',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: colors.light.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
    gap: spacing.sm,
  },
  title: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    color: colors.light.textPrimary,
    flex: 1,
  },
  close: {
    padding: spacing.xs,
  },
  closeText: {
    fontSize: 20,
    color: colors.light.textSecondary,
  },
  subtitle: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  content: {
    flexGrow: 0,
  },
  contentInner: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'android' ? spacing.md : spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    backgroundColor: colors.light.surface,
    gap: spacing.sm,
  },
});
