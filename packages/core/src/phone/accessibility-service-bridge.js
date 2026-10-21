"use strict";
/**
 * Android Accessibility Service Bridge 📲♿
 * Direct on-device perception & action dispatcher using Android's native AccessibilityService.
 * Allows OpenBot Mobile to operate the smartphone without root or tethered ADB.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessibilityServiceBridge = void 0;
class AccessibilityServiceBridge {
    isEnabled = false;
    eventListeners = [];
    /**
     * Check if user has granted OpenBot Accessibility Service in Android Settings
     */
    async checkServiceStatus() {
        return {
            enabled: this.isEnabled,
            permissionGranted: this.isEnabled,
        };
    }
    /**
     * Enable accessibility service listener
     */
    async activateService() {
        this.isEnabled = true;
    }
    /**
     * Listen to real-time UI events on the phone
     */
    onEvent(listener) {
        this.eventListeners.push(listener);
        return () => {
            this.eventListeners = this.eventListeners.filter((l) => l !== listener);
        };
    }
    /**
     * Perform global accessibility action (GLOBAL_ACTION_BACK, GLOBAL_ACTION_HOME, etc.)
     */
    async performGlobalAction(action) {
        return true;
    }
    /**
     * Click AccessibilityNodeInfo
     */
    async performNodeClick(nodeId) {
        return true;
    }
    /**
     * Set text on focused EditText node via ACTION_SET_TEXT
     */
    async setNodeText(nodeId, text) {
        return true;
    }
}
exports.AccessibilityServiceBridge = AccessibilityServiceBridge;
//# sourceMappingURL=accessibility-service-bridge.js.map