import React, { useRef } from 'react';
import { Pressable, type LayoutChangeEvent } from 'react-native';

const DOUBLE_TAP_DELAY_MS = 300;

type Side = 'left' | 'right';

interface DoubleTapZoneProps {
  side: Side;
  onSingleTap: () => void;
  onDoubleTap: () => void;
  style?: object;
  children?: React.ReactNode;
}

export function DoubleTapZone({
  side,
  onSingleTap,
  onDoubleTap,
  style,
  children,
}: DoubleTapZoneProps) {
  const lastTapTimeRef = useRef(0);
  const pendingSingleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePress = () => {
    const now = Date.now();
    const elapsed = now - lastTapTimeRef.current;

    if (pendingSingleRef.current) {
      clearTimeout(pendingSingleRef.current);
      pendingSingleRef.current = null;
    }

    if (elapsed <= DOUBLE_TAP_DELAY_MS && elapsed > 0) {
      lastTapTimeRef.current = 0;
      onDoubleTap();
    } else {
      lastTapTimeRef.current = now;
      pendingSingleRef.current = setTimeout(() => {
        pendingSingleRef.current = null;
        onSingleTap();
      }, DOUBLE_TAP_DELAY_MS);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={style}
      accessibilityLabel={
        side === 'left'
          ? 'Double tap to skip back 10 seconds'
          : 'Double tap to skip forward 10 seconds'
      }
      accessibilityRole="button"
    >
      {children}
    </Pressable>
  );
}
