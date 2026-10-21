package com.openbot.agent

import android.app.Activity
import android.os.Bundle

class MainActivity : Activity() {
    private lateinit var bridge: OpenBotBridge

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        bridge = OpenBotBridge(this)

        // If accessibility service is not yet enabled, prompt user
        if (!bridge.isAccessibilityEnabled()) {
            bridge.openAccessibilitySettings()
        }
    }
}
