const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to fix white/black flash during Android screen transitions.
 * See: https://github.com/software-mansion/react-native-screens/issues/1968
 */
function withAndroidTransitionFix(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidRoot = path.join(projectRoot, 'android');

      const drawableDir = path.join(androidRoot, 'app/src/main/res/drawable');
      const drawableFile = path.join(drawableDir, 'alpha_screen.xml');
      const valuesDir = path.join(androidRoot, 'app/src/main/res/values');
      const stylesPath = path.join(valuesDir, 'styles.xml');

      fs.mkdirSync(drawableDir, { recursive: true });

      const alphaScreenXml = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android" android:opacity="opaque">
    <item android:gravity="fill">
        <color android:color="@android:color/transparent" />
    </item>
</layer-list>
`;
      fs.writeFileSync(drawableFile, alphaScreenXml);

      // Inject native nav bar transparency into MainActivity.onCreate
      const javaDir = path.join(androidRoot, 'app/src/main/java/com/anonymous/featherneko');
      const mainActivityPath = path.join(javaDir, 'MainActivity.kt');
      if (fs.existsSync(mainActivityPath)) {
        let mainActivity = fs.readFileSync(mainActivityPath, 'utf8');
        if (!mainActivity.includes('forceNavBarTransparent')) {
          // Add imports
          if (!mainActivity.includes('import android.graphics.Color')) {
            mainActivity = mainActivity.replace(
              'import android.os.Build',
              'import android.graphics.Color\nimport android.os.Build'
            );
          }
          if (!mainActivity.includes('import androidx.core.view.WindowCompat')) {
            mainActivity = mainActivity.replace(
              'import android.os.Bundle',
              'import android.os.Bundle\nimport androidx.core.view.WindowCompat\nimport androidx.core.view.WindowInsetsControllerCompat'
            );
          }
          // Add forceNavBarTransparent() call + helper + onResume/onWindowFocusChanged overrides
          mainActivity = mainActivity.replace(
            'super.onCreate(null)',
            `super.onCreate(null)
    forceNavBarTransparent()
  }

  override fun onResume() {
    super.onResume()
    window.decorView.post { forceNavBarTransparent() }
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) forceNavBarTransparent()
  }

  private fun forceNavBarTransparent() {
    window.navigationBarColor = Color.TRANSPARENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isNavigationBarContrastEnforced = false
    }
    WindowCompat.setDecorFitsSystemWindows(window, false)
    WindowInsetsControllerCompat(window, window.decorView).apply {
      isAppearanceLightNavigationBars = false
    }`
          );
          // Remove the duplicate closing brace from onCreate that we just broke
          // (the original had `super.onCreate(null)\n  }` and we replaced just the first line)
          fs.writeFileSync(mainActivityPath, mainActivity);
        }
      }

      if (fs.existsSync(stylesPath)) {
        let styles = fs.readFileSync(stylesPath, 'utf8');
        const additions = [];
        if (!styles.includes('android:windowBackground')) {
          additions.push('<item name="android:windowBackground">@drawable/alpha_screen</item>');
        }
        // Remove deprecated windowTranslucentNavigation — it adds a system scrim on Android 15+
        if (styles.includes('android:windowTranslucentNavigation')) {
          styles = styles.replace(/\s*<item name="android:windowTranslucentNavigation">[^<]*<\/item>/, '');
          modified = true;
        }
        // Set nav bar transparent in XML theme (takes effect before any code runs)
        if (!styles.includes('android:navigationBarColor')) {
          additions.push('<item name="android:navigationBarColor">@android:color/transparent</item>');
        }
        // Disable nav bar contrast scrim so translucency works from cold start
        let modified = false;
        if (styles.includes('android:enforceNavigationBarContrast') && styles.includes('>true<')) {
          styles = styles.replace(
            /(<item name="android:enforceNavigationBarContrast"[^>]*>)true/,
            '$1false'
          );
          modified = true;
        } else if (!styles.includes('android:enforceNavigationBarContrast')) {
          additions.push('<item name="android:enforceNavigationBarContrast" tools:targetApi="29">false</item>');
        }
        if (additions.length > 0) {
          styles = styles.replace(
            /(<style name="AppTheme"[^>]*>)/,
            `$1\n        ${additions.join('\n        ')}`
          );
          modified = true;
        }
        if (modified) {
          fs.writeFileSync(stylesPath, styles);
        }
      }

      return config;
    },
  ]);
}

module.exports = withAndroidTransitionFix;
