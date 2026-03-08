/**
 * Stub for react-native-reanimated when the native module is not available
 * (e.g. Expo Go or dev client without Reanimated properly built).
 * Prevents ReanimatedModule NullPointerException and makeMutable undefined errors.
 */
const React = require('react');
const { View, ScrollView, FlatList } = require('react-native');

function makeMutable(initial) {
  return { value: initial };
}

function useSharedValue(initial) {
  return React.useRef({ value: initial }).current;
}

function useEvent() {
  return () => {};
}

function useAnimatedScrollHandler() {
  return () => {};
}

function useAnimatedStyle() {
  return {};
}

function useAnimatedProps() {
  return {};
}

function useDerivedValue() {
  return { value: undefined };
}

function useAnimatedRef() {
  return React.useRef(null);
}

function runOnUI(fn) {
  return () => {
    try {
      fn();
    } catch (_) {}
  };
}

function runOnJS(fn) {
  return fn;
}

function measure() {
  return Promise.resolve({ width: 0, height: 0, x: 0, y: 0, pageX: 0, pageY: 0 });
}

function startScreenTransition() {}
function finishScreenTransition() {}

function interpolate() {
  return 0;
}

function withSpring(value) {
  return value;
}

function withTiming(value) {
  return value;
}

const Extrapolation = {
  IDENTITY: 'identity',
  CLAMP: 'clamp',
  EXTEND: 'extend',
};

const ReduceMotion = { System: 0, Always: 1, Never: 2 };

const ScreenTransition = {
  SwipeRight: 0,
  SwipeLeft: 1,
  SwipeDown: 2,
  SwipeUp: 3,
  Horizontal: 4,
  Vertical: 5,
  TwoDimensional: 6,
};

function createAnimatedComponent(Component) {
  return Component;
}

const Animated = {
  createAnimatedComponent,
  View,
  ScrollView: createAnimatedComponent(ScrollView),
  FlatList: createAnimatedComponent(FlatList),
};

module.exports = {
  default: Animated,
  makeMutable,
  useSharedValue,
  useEvent,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useAnimatedProps,
  useDerivedValue,
  useAnimatedRef,
  runOnUI,
  runOnJS,
  measure,
  startScreenTransition,
  finishScreenTransition,
  interpolate,
  withSpring,
  withTiming,
  Extrapolation,
  ReduceMotion,
  ScreenTransition,
  createAnimatedComponent,
  Animated,
};
