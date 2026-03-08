import React, { useEffect, useRef } from 'react';
import { Image, View, Animated, StyleSheet } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faImage } from '@fortawesome/free-solid-svg-icons';
import { useThemeColors } from '@/hooks/useThemeColors';

interface ImageWithFallbackProps {
  source: { uri: string } | number;
  className?: string;
  style?: object;
  resizeMode?: 'cover' | 'contain' | 'stretch';
  accessibilityLabel?: string;
  /** Fade-in duration (ms). 0 = no animation */
  fadeInDuration?: number;
}

/** Image with fallback placeholder and optional fade-in */
export function ImageWithFallback({
  source,
  className = '',
  style = {},
  resizeMode = 'cover',
  accessibilityLabel,
  fadeInDuration = 280,
}: ImageWithFallbackProps) {
  const [failed, setFailed] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const { hex } = useThemeColors();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (loaded && fadeInDuration > 0) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: fadeInDuration,
        useNativeDriver: true,
      }).start();
    } else if (loaded) {
      opacity.setValue(1);
    }
  }, [loaded, fadeInDuration, opacity]);

  if (failed) {
    return (
      <View
        className={className}
        style={[
          {
            backgroundColor: hex.elevated,
            alignItems: 'center',
            justifyContent: 'center',
          },
          style,
        ]}
        accessibilityLabel={accessibilityLabel}
      >
        <FontAwesomeIcon icon={faImage} size={24} color={hex.textTertiary} />
      </View>
    );
  }

  const flatStyle = StyleSheet.flatten(style) || {};

  return (
    <View style={[style, { overflow: 'hidden' }]}>
      {!loaded && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: hex.skeletonBase,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <FontAwesomeIcon icon={faImage} size={20} color={hex.textTertiary} />
        </View>
      )}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { opacity: loaded ? opacity : 0 },
        ]}
      >
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          resizeMode={resizeMode}
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
          accessibilityLabel={accessibilityLabel}
        />
      </Animated.View>
    </View>
  );
}
