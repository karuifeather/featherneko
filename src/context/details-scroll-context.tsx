import React, { createContext, useContext, useRef } from 'react';
import { Animated } from 'react-native';

interface DetailsScrollContextValue {
  scrollY: Animated.Value;
  scrollEventThrottle: number;
}

const DetailsScrollContext = createContext<DetailsScrollContextValue | null>(null);

export function DetailsScrollProvider({
  children,
  scrollY,
  scrollEventThrottle = 16,
}: {
  children: React.ReactNode;
  scrollY: Animated.Value;
  scrollEventThrottle?: number;
}) {
  const value: DetailsScrollContextValue = {
    scrollY,
    scrollEventThrottle,
  };
  return (
    <DetailsScrollContext.Provider value={value}>
      {children}
    </DetailsScrollContext.Provider>
  );
}

export function useDetailsScroll() {
  return useContext(DetailsScrollContext);
}

/**
 * Creates scroll event handler for ScrollView/FlatList.
 * useNativeDriver: false required for layout properties (height).
 */
export function useDetailsScrollHandler(scrollY: Animated.Value) {
  return Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );
}
