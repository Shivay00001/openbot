package com.openbot.agent

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Intent
import android.graphics.Path
import android.graphics.Rect
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject

/**
 * OpenBot Native Android Accessibility Service
 * 
 * Provides rootless, 100% on-device autonomous smartphone automation:
 * - Real-time UI tree parsing across all Android apps (WhatsApp, Uber, Chrome, etc.)
 * - Native touch clicks, gestures, swipes, and text injection
 * - Hardware navigation controls (Home, Back, Recents)
 * - Zero PC/laptop dependency — executes directly on the phone OS
 */
class OpenBotAccessibilityService : AccessibilityService() {

    companion object {
        var instance: OpenBotAccessibilityService? = null
            private set

        val isRunning: Boolean
            get() = instance != null
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        // Start foreground companion service hosting the local phone API daemon
        val agentServiceIntent = Intent(this, OpenBotAgentService::class.java)
        startService(agentServiceIntent)
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Continuous state perception
        if (event == null) return
        val currentPackage = event.packageName?.toString() ?: ""
        // Send state updates to local agent observer
    }

    override fun onInterrupt() {
        // Handled gracefully
    }

    // ─── Native Phone Control Primitives ───────────────────────────

    /**
     * Tap by screen pixel coordinates using gesture injection
     */
    fun tapCoordinate(x: Float, y: Float): Boolean {
        val path = Path().apply {
            moveTo(x, y)
        }
        val stroke = GestureDescription.StrokeDescription(path, 0, 50)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()
        return dispatchGesture(gesture, null, null)
    }

    /**
     * Smooth swipe gesture between two points
     */
    fun swipe(fromX: Float, fromY: Float, toX: Float, toY: Float, durationMs: Long = 300): Boolean {
        val path = Path().apply {
            moveTo(fromX, fromY)
            lineTo(toX, toY)
        }
        val stroke = GestureDescription.StrokeDescription(path, 0, durationMs)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()
        return dispatchGesture(gesture, null, null)
    }

    /**
     * Click on a UI element matching visible text
     */
    fun clickByText(targetText: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val nodes = root.findAccessibilityNodeInfosByText(targetText)
        if (nodes.isNullOrEmpty()) return false

        for (node in nodes) {
            val clickable = findClickableParent(node)
            if (clickable != null && clickable.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                return true
            }
        }
        return false
    }

    /**
     * Click on a UI element matching Android view resource ID
     */
    fun clickById(viewId: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val nodes = root.findAccessibilityNodeInfosByViewId(viewId)
        if (nodes.isNullOrEmpty()) return false

        for (node in nodes) {
            val clickable = findClickableParent(node)
            if (clickable != null && clickable.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                return true
            }
        }
        return false
    }

    /**
     * Set text directly into currently focused editable field
     */
    fun typeText(text: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
        if (focused != null && focused.isEditable) {
            val args = Bundle().apply {
                putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
            }
            return focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
        }
        return false
    }

    /**
     * Hardware Navigation Actions
     */
    fun pressBack(): Boolean = performGlobalAction(GLOBAL_ACTION_BACK)
    fun pressHome(): Boolean = performGlobalAction(GLOBAL_ACTION_HOME)
    fun pressRecents(): Boolean = performGlobalAction(GLOBAL_ACTION_RECENTS)
    fun openNotifications(): Boolean = performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)

    /**
     * Launch an Android application by package name
     */
    fun launchApp(packageName: String): Boolean {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName) ?: return false
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        startActivity(launchIntent)
        return true
    }

    /**
     * Parse and dump the entire active screen into structured JSON
     */
    fun getHierarchyJson(): String {
        val root = rootInActiveWindow ?: return "{ \"error\": \"No active window\" }"
        val json = JSONObject()
        json.put("packageName", root.packageName?.toString() ?: "")
        json.put("className", root.className?.toString() ?: "")
        json.put("elements", parseNodeRecursive(root))
        return json.toString()
    }

    private fun parseNodeRecursive(node: AccessibilityNodeInfo): JSONArray {
        val array = JSONArray()
        val rect = Rect()
        node.getBoundsInScreen(rect)

        val nodeObj = JSONObject().apply {
            put("text", node.text?.toString() ?: "")
            put("contentDescription", node.contentDescription?.toString() ?: "")
            put("viewId", node.viewIdResourceName ?: "")
            put("className", node.className?.toString() ?: "")
            put("isClickable", node.isClickable)
            put("isEditable", node.isEditable)
            put("bounds", JSONObject().apply {
                put("left", rect.left)
                put("top", rect.top)
                put("right", rect.right)
                put("bottom", rect.bottom)
                put("centerX", rect.centerX())
                put("centerY", rect.centerY())
            })
        }
        array.put(nodeObj)

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val childArray = parseNodeRecursive(child)
            for (j in 0 until childArray.length()) {
                array.put(childArray.get(j))
            }
        }
        return array
    }

    private fun findClickableParent(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        var current = node
        while (current != null) {
            if (current.isClickable) return current
            current = current.parent
        }
        return null
    }
}
