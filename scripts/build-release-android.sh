#!/usr/bin/env bash
# Build a release APK locally. Requires: yarn deps, expo prebuild, debug keystore, Android SDK.
# Uses Java 17 if available (required for React Native Gradle plugin).

set -e
cd "$(dirname "$0")/.."

# Prefer Java 17 for Android/RN builds (required for React Native Gradle plugin)
if [[ -z "$JAVA_HOME" || ! -x "$JAVA_HOME/bin/javac" ]]; then
  for candidate in /usr/lib/jvm/java-17-temurin-jdk /usr/lib/jvm/java-17-openjdk; do
    if [[ -x "$candidate/bin/javac" ]]; then
      export JAVA_HOME="$candidate"
      break
    fi
  done
fi

if [[ -z "$JAVA_HOME" ]]; then
  echo "Warning: JAVA_HOME not set to Java 17. If the build fails with 'Error resolving plugin', install JDK 17 and set JAVA_HOME."
fi

if [[ ! -d android ]]; then
  echo "Run from repo root after: npx expo prebuild --platform android --no-install"
  exit 1
fi

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
if [[ ! -f android/local.properties ]]; then
  echo "sdk.dir=$ANDROID_HOME" > android/local.properties
fi

echo "Using JAVA_HOME=$JAVA_HOME"
"$JAVA_HOME/bin/java" -version 2>&1 || true

cd android
./gradlew assembleRelease --no-daemon

APK=app/build/outputs/apk/release/app-release.apk
if [[ -f "$APK" ]]; then
  echo ""
  echo "APK built: android/$APK"
  cp "$APK" ../featherneko.apk
  echo "Copied to: featherneko.apk"
fi
