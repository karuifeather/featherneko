import { View, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import {
  BottomTabBar,
  type BottomTabBarProps,
} from "@react-navigation/bottom-tabs";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useEdgeToEdgeInsets } from "@/hooks/useEdgeToEdgeInsets";
import { DARK_HEX, LIGHT_HEX } from "@/constants/designTokens";
import { TAB_BAR_BASE_HEIGHT } from "@/hooks/useEdgeToEdgeInsets";

/**
 * Tab bar with translucent background that merges with Android system nav bar.
 * Uses BlurView + semi-transparent overlay on Android/iOS for translucency.
 */
export function TranslucentTabBar(props: BottomTabBarProps) {
  const { isDark } = useThemeColors();
  const { tabBarHeight, bottom: insetBottom } = useEdgeToEdgeInsets();
  // On Android: position tab content 10px above bottom so labels clear the nav bar
  const tabContentBottom = Platform.OS === "android" ? 10 : 0;
  const themeHex = isDark ? DARK_HEX : LIGHT_HEX;
  const isAndroid = Platform.OS === "android";

  const blurOrSolid =
    (isAndroid || (isDark && Platform.OS !== "web")) ? (
    <>
      <BlurView
        intensity={80}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: DARK_HEX.translucentOverlay },
        ]}
      />
    </>
  ) : (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: themeHex.overlayBg }]}
    />
  );

  return (
    <View
      style={[
        styles.container,
        {
          borderTopColor: themeHex.overlayBorder,
          borderTopWidth: isAndroid ? 0.5 : 1,
          height: tabBarHeight,
        },
      ]}
    >
      {blurOrSolid}
      <View
        style={[
          styles.tabBarContent,
          isAndroid
            ? {
                position: "absolute" as const,
                bottom: tabContentBottom,
                left: 0,
                right: 0,
                height: TAB_BAR_BASE_HEIGHT,
              }
            : { paddingBottom: insetBottom },
        ]}
      >
        <BottomTabBar {...props} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContent: {
    flex: 1,
  },
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
});
