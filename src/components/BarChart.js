// BarChart — chart batang berbasis View, tanpa dependency chart tambahan.
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, radii, typography } from '../theme/tokens';

function compactRupiah(value) {
  const num = Number(value) || 0;
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)} M`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)} jt`;
  if (num >= 1_000) return `${Math.round(num / 1_000)} rb`;
  return String(Math.round(num));
}

export default function BarChart({
  data = [],
  height = 140,
  emptyMessage = 'Belum ada data untuk periode ini.',
  valuePrefix = 'Rp ',
}) {
  const max = Math.max(
    1,
    ...data.map((item) => Math.max(Number(item.value) || 0, Number(item.secondaryValue) || 0)),
  );
  const hasValues = data.some(
    (item) => Number(item.value) > 0 || Number(item.secondaryValue) > 0,
  );

  if (!data.length || !hasValues) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  const chart = (
    <View style={[styles.row, data.length <= 6 && styles.rowFill]}>
      {data.map((item, index) => {
        const value = Number(item.value) || 0;
        const secondary = Number(item.secondaryValue) || 0;
        const primaryHeight = Math.max(4, (value / max) * height);
        const secondaryHeight = Math.max(4, (secondary / max) * height);
        return (
          <View
            key={`${item.label}-${index}`}
            style={[styles.slot, data.length <= 6 && styles.slotFill]}
            accessible
            accessibilityLabel={`${item.label}: ${valuePrefix}${value.toLocaleString('id-ID')}`}
          >
            <Text style={styles.valueLabel}>{compactRupiah(value)}</Text>
            <View style={[styles.barArea, { height }]}>
              <View style={styles.bars}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: primaryHeight,
                      backgroundColor: item.color || colors.light.primary,
                    },
                  ]}
                />
                {item.secondaryValue !== undefined ? (
                  <View
                    style={[
                      styles.bar,
                      {
                        height: secondaryHeight,
                        backgroundColor: item.secondaryColor || colors.light.primaryLight,
                      },
                    ]}
                  />
                ) : null}
              </View>
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {item.label}
            </Text>
            {item.secondaryValue !== undefined ? (
              <Text style={styles.secondaryValue}>
                {compactRupiah(secondary)}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );

  if (data.length > 6) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {chart}
      </ScrollView>
    );
  }

  return chart;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  rowFill: { width: '100%' },
  slot: {
    minWidth: 48,
    alignItems: 'center',
  },
  slotFill: { flex: 1, minWidth: 0 },
  valueLabel: {
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.weights.semibold,
    fontSize: 9,
    color: colors.light.textSecondary,
    marginBottom: spacing.xs,
  },
  barArea: { justifyContent: 'flex-end' },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  bar: {
    width: 14,
    borderTopLeftRadius: radii.sm,
    borderTopRightRadius: radii.sm,
  },
  label: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 9,
    color: colors.light.textPrimary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  secondaryValue: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 8,
    color: colors.light.textSecondary,
    marginTop: 1,
  },
  emptyBox: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    color: colors.light.textSecondary,
    textAlign: 'center',
  },
});
