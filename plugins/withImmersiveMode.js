const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const IMMERSIVE_MODULE_KOTLIN = `package com.anonymous.featherneko

import android.graphics.Color
import android.os.Build
import android.view.View
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ImmersiveModeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ImmersiveMode"

    @ReactMethod
    fun setImmersiveMode(enabled: Boolean) {
        val activity = getReactApplicationContext()?.currentActivity ?: return
        activity.runOnUiThread {
            val window = activity.window ?: return@runOnUiThread
            val decorView = window.decorView
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val controller = WindowInsetsControllerCompat(window, decorView)
                if (enabled) {
                    controller.hide(WindowInsetsCompat.Type.navigationBars())
                    controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                } else {
                    controller.show(WindowInsetsCompat.Type.navigationBars())
                }
            } else {
                @Suppress("DEPRECATION")
                if (enabled) {
                    decorView.systemUiVisibility = (
                        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    )
                } else {
                    decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
                }
            }
        }
    }

    @ReactMethod
    fun setNavBarTransparent() {
        val activity = getReactApplicationContext()?.currentActivity ?: return
        activity.runOnUiThread {
            val window = activity.window ?: return@runOnUiThread
            window.navigationBarColor = Color.TRANSPARENT
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                window.isNavigationBarContrastEnforced = false
            }
            WindowCompat.setDecorFitsSystemWindows(window, false)
            WindowInsetsControllerCompat(window, window.decorView).apply {
                isAppearanceLightNavigationBars = false
            }
        }
    }
}
`;

const IMMERSIVE_PACKAGE_KOTLIN = `package com.anonymous.featherneko

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class ImmersiveModePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(ImmersiveModeModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;

function withImmersiveMode(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidRoot = path.join(projectRoot, 'android');
      const javaDir = path.join(
        androidRoot,
        'app/src/main/java/com/anonymous/featherneko'
      );
      const mainAppPath = path.join(javaDir, 'MainApplication.kt');

      fs.mkdirSync(javaDir, { recursive: true });

      fs.writeFileSync(
        path.join(javaDir, 'ImmersiveModeModule.kt'),
        IMMERSIVE_MODULE_KOTLIN
      );
      fs.writeFileSync(
        path.join(javaDir, 'ImmersiveModePackage.kt'),
        IMMERSIVE_PACKAGE_KOTLIN
      );

      if (fs.existsSync(mainAppPath)) {
        let mainApp = fs.readFileSync(mainAppPath, 'utf8');
        if (!mainApp.includes('ImmersiveModePackage')) {
          mainApp = mainApp.replace(
            '// Packages that cannot be autolinked yet can be added manually here, for example:\n              // add(MyReactNativePackage())',
            '// Packages that cannot be autolinked yet can be added manually here, for example:\n              add(ImmersiveModePackage())'
          );
          fs.writeFileSync(mainAppPath, mainApp);
        }
      }

      return config;
    },
  ]);
}

module.exports = withImmersiveMode;
