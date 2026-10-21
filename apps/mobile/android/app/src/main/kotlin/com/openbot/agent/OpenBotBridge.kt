package com.openbot.agent

import android.content.Context
import android.content.Intent
import android.provider.Settings

/**
 * OpenBot Native Bridge for Flutter / React Native Mobile UI
 */
class OpenBotBridge(private val context: Context) {

    /**
     * Check if the user has granted Accessibility Service permissions
     */
    fun isAccessibilityEnabled(): Boolean {
        return OpenBotAccessibilityService.isRunning
    }

    /**
     * Open system accessibility settings screen to prompt user enablement
     */
    fun openAccessibilitySettings() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    /**
     * Dispatch click on screen coordinate
     */
    fun tap(x: Float, y: Float): Boolean {
        return OpenBotAccessibilityService.instance?.tapCoordinate(x, y) ?: false
    }

    /**
     * Dispatch click on UI element matching text
     */
    fun clickText(text: String): Boolean {
        return OpenBotAccessibilityService.instance?.clickByText(text) ?: false
    }

    /**
     * Type text into currently active field
     */
    fun type(text: String): Boolean {
        return OpenBotAccessibilityService.instance?.typeText(text) ?: false
    }

    /**
     * Retrieve structured UI hierarchy of the active screen
     */
    fun getScreenState(): String {
        return OpenBotAccessibilityService.instance?.getHierarchyJson()
            ?: "{ \"error\": \"Accessibility Service inactive\" }"
    }

    /**
     * Launch an app
     */
    fun launchApp(packageName: String): Boolean {
        return OpenBotAccessibilityService.instance?.launchApp(packageName) ?: false
    }
}
