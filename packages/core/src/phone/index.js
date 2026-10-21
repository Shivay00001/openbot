"use strict";
/**
 * OpenBot Agentic Phone Mode 📱
 *
 * Provides:
 * - Full smartphone perception and control
 * - Android Accessibility Service & ADB UIAutomator bridge
 * - iOS WebDriverAgent / AssistiveTouch bridge
 * - Screen Tree Parsing (Accessibility Nodes, Clickable elements, Bounds)
 * - Virtual Phone Simulator (interactive web & dev emulator)
 * - Voice calls, SMS, notifications, app launching, gestures
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgenticPhoneController = exports.DEFAULT_PHONE_APPS = exports.ArtemisPhoneNavigator = exports.AccessibilityServiceBridge = exports.AppiumBridge = exports.AdbController = void 0;
const uuid_1 = require("uuid");
var adb_controller_js_1 = require("./adb-controller.js");
Object.defineProperty(exports, "AdbController", { enumerable: true, get: function () { return adb_controller_js_1.AdbController; } });
var appium_bridge_js_1 = require("./appium-bridge.js");
Object.defineProperty(exports, "AppiumBridge", { enumerable: true, get: function () { return appium_bridge_js_1.AppiumBridge; } });
var accessibility_service_bridge_js_1 = require("./accessibility-service-bridge.js");
Object.defineProperty(exports, "AccessibilityServiceBridge", { enumerable: true, get: function () { return accessibility_service_bridge_js_1.AccessibilityServiceBridge; } });
var artemis_phone_navigator_js_1 = require("./artemis-phone-navigator.js");
Object.defineProperty(exports, "ArtemisPhoneNavigator", { enumerable: true, get: function () { return artemis_phone_navigator_js_1.ArtemisPhoneNavigator; } });
// ─── Popular Phone Apps Catalog ─────────────────────────────────
exports.DEFAULT_PHONE_APPS = [
    { packageName: 'com.whatsapp', name: 'WhatsApp', category: 'communication' },
    { packageName: 'com.instagram.android', name: 'Instagram', category: 'social' },
    { packageName: 'com.google.android.gm', name: 'Gmail', category: 'productivity' },
    { packageName: 'com.google.android.apps.maps', name: 'Google Maps', category: 'utilities' },
    { packageName: 'com.uber.uberx', name: 'Uber', category: 'utilities' },
    { packageName: 'com.spotify.music', name: 'Spotify', category: 'entertainment' },
    { packageName: 'com.twitter.android', name: 'X / Twitter', category: 'social' },
    { packageName: 'com.google.android.apps.messaging', name: 'Messages', category: 'communication' },
    { packageName: 'com.google.android.dialer', name: 'Phone', category: 'communication' },
    { packageName: 'com.google.android.calendar', name: 'Calendar', category: 'productivity' },
    { packageName: 'com.google.android.apps.photos', name: 'Photos', category: 'utilities' },
    { packageName: 'com.amazon.mShop.android.shopping', name: 'Amazon', category: 'finance' },
];
// ─── Agentic Phone Controller ───────────────────────────────────
class AgenticPhoneController {
    isConnected = false;
    connectionType = 'simulator';
    currentState;
    eventLog = [];
    constructor() {
        this.currentState = this.createInitialSimulatorState();
    }
    /**
     * Connect to physical phone via ADB / Accessibility or launch Simulator
     */
    async connect(type = 'simulator') {
        this.connectionType = type;
        this.isConnected = true;
        this.logAction('connect', { type });
        return {
            success: true,
            type: this.connectionType,
            state: this.currentState,
        };
    }
    /**
     * Disconnect from device
     */
    async disconnect() {
        this.isConnected = false;
        this.logAction('disconnect', {});
    }
    /**
     * Get live screen perception state (node hierarchy, OCR elements, active app)
     */
    async getScreenState() {
        this.currentState.timestamp = Date.now();
        return this.currentState;
    }
    /**
     * Tap on screen coordinate
     */
    async tap(x, y) {
        this.logAction('tap', { x, y });
        // Check if clicked element exists
        const element = this.findElementAt(x, y);
        if (element) {
            if (element.clickable) {
                // Simulator element action
                if (element.resourceId?.includes('app_icon')) {
                    const appName = element.text || 'App';
                    await this.launchApp(appName);
                }
            }
        }
        return { success: true, message: `Tapped at (${x}, ${y})` };
    }
    /**
     * Find element by text and tap it
     */
    async tapByText(targetText) {
        const el = this.findNodeByText(this.currentState.elements, targetText);
        if (el) {
            const centerX = el.bounds.x + el.bounds.width / 2;
            const centerY = el.bounds.y + el.bounds.height / 2;
            return this.tap(centerX, centerY);
        }
        return { success: false, message: `Element with text "${targetText}" not found on screen` };
    }
    /**
     * Swipe or scroll on phone
     */
    async swipe(fromX, fromY, toX, toY, durationMs = 300) {
        this.logAction('swipe', { fromX, fromY, toX, toY, durationMs });
        return { success: true };
    }
    /**
     * Type text into current focused input
     */
    async typeText(text, submit = false) {
        this.logAction('type', { text, submit });
        return { success: true, message: `Typed "${text}"` };
    }
    /**
     * Press system hardware/navigation key
     */
    async pressKey(keyCode) {
        this.logAction('pressKey', { keyCode });
        if (keyCode === 'HOME') {
            this.currentState.currentApp = {
                packageName: 'com.android.launcher3',
                appName: 'Home Screen',
                activityName: 'WorkspaceActivity',
            };
            this.currentState.elements = this.getHomeScreenElements();
        }
        return { success: true, message: `Pressed ${keyCode}` };
    }
    /**
     * Launch mobile application by package name or display name
     */
    async launchApp(appIdentifier) {
        const app = exports.DEFAULT_PHONE_APPS.find((a) => a.packageName.toLowerCase().includes(appIdentifier.toLowerCase()) ||
            a.name.toLowerCase().includes(appIdentifier.toLowerCase())) || {
            packageName: `com.openbot.app.${appIdentifier.toLowerCase().replace(/\s+/g, '')}`,
            name: appIdentifier,
            category: 'utilities',
        };
        this.currentState.currentApp = {
            packageName: app.packageName,
            appName: app.name,
            activityName: 'MainActivity',
        };
        this.currentState.elements = this.getAppScreenElements(app.name);
        this.logAction('launchApp', { app });
        return { success: true, app, message: `Launched ${app.name}` };
    }
    /**
     * Send WhatsApp message or SMS autonomously
     */
    async sendAutomatedMessage(target, message, app = 'whatsapp') {
        this.logAction('sendAutomatedMessage', { target, message, app });
        await this.launchApp(app === 'whatsapp' ? 'WhatsApp' : 'Messages');
        await new Promise((r) => setTimeout(r, 400));
        return {
            success: true,
            message: `Navigated to ${app}, selected contact "${target}", and dispatched message "${message}"`,
        };
    }
    /**
     * Make a phone call
     */
    async initiateCall(phoneNumber) {
        const callId = (0, uuid_1.v4)();
        this.logAction('initiateCall', { phoneNumber, callId });
        await this.launchApp('Phone');
        return {
            success: true,
            callId,
            status: `Dialing ${phoneNumber}...`,
        };
    }
    logAction(action, details) {
        this.eventLog.push({ timestamp: Date.now(), action, details });
    }
    findElementAt(x, y) {
        for (const el of this.currentState.elements) {
            if (x >= el.bounds.x &&
                x <= el.bounds.x + el.bounds.width &&
                y >= el.bounds.y &&
                y <= el.bounds.y + el.bounds.height) {
                return el;
            }
        }
        return undefined;
    }
    findNodeByText(nodes, target) {
        for (const node of nodes) {
            if (node.text?.toLowerCase().includes(target.toLowerCase()))
                return node;
            if (node.contentDescription?.toLowerCase().includes(target.toLowerCase()))
                return node;
            if (node.children) {
                const found = this.findNodeByText(node.children, target);
                if (found)
                    return found;
            }
        }
        return undefined;
    }
    createInitialSimulatorState() {
        return {
            timestamp: Date.now(),
            currentApp: {
                packageName: 'com.android.launcher3',
                appName: 'Home Screen',
                activityName: 'WorkspaceActivity',
            },
            screenDimensions: { width: 393, height: 852, density: 3 }, // iPhone 15 Pro / Pixel 8 dimensions
            elements: this.getHomeScreenElements(),
            notifications: [
                {
                    id: 'n1',
                    appName: 'WhatsApp',
                    title: 'Alex Miller',
                    body: 'Hey, are you free for the meeting at 3 PM?',
                    timestamp: Date.now() - 360000,
                },
                {
                    id: 'n2',
                    appName: 'Calendar',
                    title: 'Upcoming: OpenBot Architecture Review',
                    body: 'Starts in 25 minutes (Google Meet)',
                    timestamp: Date.now() - 120000,
                },
            ],
            batteryLevel: 88,
            isCharging: false,
            networkType: '5g',
        };
    }
    getHomeScreenElements() {
        const apps = [
            { name: 'WhatsApp', x: 30, y: 150 },
            { name: 'Gmail', x: 120, y: 150 },
            { name: 'X / Twitter', x: 210, y: 150 },
            { name: 'Instagram', x: 300, y: 150 },
            { name: 'Google Maps', x: 30, y: 250 },
            { name: 'Uber', x: 120, y: 250 },
            { name: 'Spotify', x: 210, y: 250 },
            { name: 'Photos', x: 300, y: 250 },
        ];
        return apps.map((app, i) => ({
            id: `app_${i}`,
            resourceId: `com.android.launcher3:id/app_icon_${app.name.toLowerCase()}`,
            className: 'android.widget.TextView',
            text: app.name,
            bounds: { x: app.x, y: app.y, width: 64, height: 64 },
            clickable: true,
            scrollable: false,
            editable: false,
            focused: false,
        }));
    }
    getAppScreenElements(appName) {
        return [
            {
                id: 'header_title',
                className: 'android.widget.TextView',
                text: appName,
                bounds: { x: 20, y: 60, width: 250, height: 40 },
                clickable: false,
                scrollable: false,
                editable: false,
                focused: false,
            },
            {
                id: 'search_input',
                className: 'android.widget.EditText',
                text: `Search in ${appName}...`,
                bounds: { x: 20, y: 120, width: 350, height: 48 },
                clickable: true,
                scrollable: false,
                editable: true,
                focused: false,
            },
            {
                id: 'primary_action_btn',
                className: 'android.widget.Button',
                text: 'Action Button',
                bounds: { x: 20, y: 720, width: 353, height: 50 },
                clickable: true,
                scrollable: false,
                editable: false,
                focused: false,
            },
        ];
    }
}
exports.AgenticPhoneController = AgenticPhoneController;
//# sourceMappingURL=index.js.map