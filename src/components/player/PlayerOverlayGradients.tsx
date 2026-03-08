import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/** Strong top gradient for title/navigation readability. */
const TOP_GRADIENT_HEIGHT = 140;
/** Strong bottom gradient for progress readability. */
const BOTTOM_GRADIENT_HEIGHT = 140;

const TOP_COLORS = ['rgba(0,0,0,0.82)', 'transparent'] as const;
const BOTTOM_COLORS = ['transparent', 'rgba(0,0,0,0.82)'] as const;

export function PlayerOverlayGradients() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={TOP_COLORS}
        style={[styles.top, { height: TOP_GRADIENT_HEIGHT }]}
      />
      <LinearGradient
        colors={BOTTOM_COLORS}
        style={[styles.bottom, { height: BOTTOM_GRADIENT_HEIGHT }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
