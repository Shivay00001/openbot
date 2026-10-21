/**
 * OpenBot Mobile — Agentic Phone Mode Screen
 * Controls THIS phone through the on-device OpenBot Accessibility Service,
 * exposed by the bundled LocalPhoneServer at http://127.0.0.1:8765
 * (endpoints: /health, /screen/hierarchy, /action/tap|type|swipe|key|launch).
 * Every action is a real HTTP call to that server and the UI reports the
 * server's actual response — nothing is simulated.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/lib/theme';

interface AdbDevice {
  serial: string;
  status: string;
  model: string;
  device: string;
}

interface LogEntry {
  id: string;
  text: string;
  type: 'info' | 'success' | 'error' | 'action';
}

const QUICK_ACTIONS = [
  { label: 'Launch WhatsApp', pkg: 'com.whatsapp', icon: 'chatbubble' as const },
  { label: 'Open YouTube', pkg: 'com.google.android.youtube', icon: 'play' as const },
  { label: 'Open Maps', pkg: 'com.google.android.apps.maps', icon: 'navigate' as const },
  { label: 'Open Chrome', pkg: 'com.android.chrome', icon: 'globe' as const },
  { label: 'Open Camera', pkg: 'com.android.camera', icon: 'camera' as const },
  { label: 'Open Settings', pkg: 'com.android.settings', icon: 'settings' as const },
];

const LOCAL_SERVER = 'http://127.0.0.1:8765';

interface LocalServerResponse {
  success: boolean;
  serviceActive?: boolean;
  version?: string;
  error?: string;
  [key: string]: unknown;
}

/** Real HTTP call to the on-device LocalPhoneServer with a hard timeout. */
async function localServerRequest(route: string, body?: Record<string, unknown>): Promise<LocalServerResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${LOCAL_SERVER}${route}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    return (await res.json()) as LocalServerResponse;
  } finally {
    clearTimeout(timeout);
  }
}

export default function PhoneModeScreen() {
  const [devices, setDevices] = useState<AdbDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [serverStatus, setServerStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');
  const [wirelessIp, setWirelessIp] = useState('192.168.1.');
  const [autonomousGoal, setAutonomousGoal] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: '1', text: 'System: Phone automation engine initialized.', type: 'info' },
  ]);

  const addLog = useCallback((text: string, type: LogEntry['type'] = 'info') => {
    setLogs((prev) => [{ id: `log-${Date.now()}-${Math.random()}`, text, type }, ...prev.slice(0, 30)]);
  }, []);

  const scanDevices = useCallback(async () => {
    setIsScanning(true);
    addLog('Checking the on-device OpenBot server (127.0.0.1:8765)...', 'action');
    try {
      const health = await localServerRequest('/health');
      if (health.success) {
        setServerStatus('online');
        setDevices([
          { serial: 'local-device', status: 'device', model: 'This phone (Accessibility Service)', device: 'local' },
        ]);
        addLog(`On-device server online (v${health.version || '?'}). This phone is controllable.`, 'success');
      } else {
        setServerStatus('offline');
        setDevices([]);
        addLog(health.error || 'Accessibility Service is not enabled.', 'error');
        addLog('Enable it in Android Settings → Accessibility → OpenBot.', 'info');
      }
    } catch {
      setServerStatus('offline');
      setDevices([]);
      addLog('On-device server unreachable at 127.0.0.1:8765. The OpenBot background service is not running.', 'error');
    } finally {
      setIsScanning(false);
    }
  }, [addLog]);

  useEffect(() => {
    scanDevices();
  }, []);

  const handleWirelessConnect = useCallback(() => {
    if (!wirelessIp.trim() || wirelessIp === '192.168.1.') {
      Alert.alert('Enter IP', 'Please enter your phone\'s IP address from Developer Options → Wireless Debugging');
      return;
    }
    // Wireless ADB pairing is initiated from a HOST computer (adb pair /
    // adb connect). This screen controls THIS phone through its on-device
    // accessibility server, so we verify that server instead of pretending
    // to open an ADB connection from the phone itself.
    addLog(`Wireless ADB is started from a host computer: run "adb connect ${wirelessIp}" on your PC.`, 'info');
    addLog('Verifying the on-device control server instead...', 'action');
    void scanDevices();
  }, [wirelessIp, addLog, scanDevices]);

  const handleQuickAction = useCallback(
    async (label: string, pkg: string) => {
      addLog(`Launching ${label} via the on-device server...`, 'action');
      try {
        const res = await localServerRequest('/action/launch', { packageName: pkg });
        if (res.success) {
          addLog(`✓ ${label} launched (${pkg})`, 'success');
        } else {
          addLog(`Launch failed for ${label}: ${res.error || 'server reported failure'}`, 'error');
        }
      } catch {
        addLog(`Launch failed for ${label}: on-device server unreachable. Enable the Accessibility Service first.`, 'error');
      }
    },
    [addLog],
  );

  const executeGoal = useCallback(async () => {
    if (!autonomousGoal.trim()) return;
    setIsExecuting(true);
    addLog(`Agentic Phone Controller: Processing goal "${autonomousGoal}"`, 'action');

    const goalLower = autonomousGoal.toLowerCase();
    let targetPkg: string | null = null;
    if (goalLower.includes('whatsapp')) targetPkg = 'com.whatsapp';
    else if (goalLower.includes('uber')) targetPkg = 'com.ubercab';
    else if (goalLower.includes('maps')) targetPkg = 'com.google.android.apps.maps';
    else if (goalLower.includes('youtube')) targetPkg = 'com.google.android.youtube';
    else if (goalLower.includes('chrome') || goalLower.includes('browser')) targetPkg = 'com.android.chrome';
    else if (goalLower.includes('camera')) targetPkg = 'com.android.camera';
    else if (goalLower.includes('settings')) targetPkg = 'com.android.settings';

    try {
      if (!targetPkg) {
        addLog('This goal does not name a launchable app. On-device quick goals can launch one app; multi-step goals run from the OpenBot web/host Artemis navigator.', 'error');
        return;
      }
      addLog(`Agent: Resolved target package → ${targetPkg}`, 'info');
      const res = await localServerRequest('/action/launch', { packageName: targetPkg });
      if (res.success) {
        addLog(`✓ Goal completed: launched ${targetPkg}`, 'success');
        setAutonomousGoal('');
      } else {
        addLog(`Goal failed: ${res.error || 'server reported failure'}`, 'error');
      }
    } catch {
      addLog('Goal failed: on-device server unreachable. Enable the Accessibility Service first.', 'error');
    } finally {
      setIsExecuting(false);
    }
  }, [autonomousGoal, addLog]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Status Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerLeft}>
          <View style={styles.bannerIcon}>
            <Ionicons name="phone-portrait" size={24} color="#000" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.bannerTitleRow}>
              <Text style={styles.bannerTitle}>Agentic Phone Mode</Text>
              <View style={styles.hardwareBadge}>
                <Text style={styles.hardwareBadgeText}>On-device</Text>
              </View>
            </View>
            <Text style={styles.bannerSubtitle}>
              On-device automation via the OpenBot Accessibility Service (local server :8765)
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={scanDevices}
          disabled={isScanning}
          style={styles.scanButton}
        >
          {isScanning ? (
            <ActivityIndicator size="small" color={Colors.accentCyan} />
          ) : (
            <Ionicons name="refresh" size={18} color={Colors.accentCyan} />
          )}
          <Text style={styles.scanButtonText}>Scan</Text>
        </TouchableOpacity>
      </View>

      {/* Device Status Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="hardware-chip" size={16} color={Colors.accentCyan} />
          <Text style={styles.cardTitle}>Device Control Status</Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>On-device Server</Text>
          <Text style={[styles.statusValue, { color: serverStatus === 'online' ? Colors.accentEmerald : Colors.textMuted }]}>
            {serverStatus === 'online' ? 'Online (127.0.0.1:8765)' : serverStatus === 'offline' ? 'Offline — enable Accessibility' : 'Checking...'}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Devices Attached</Text>
          <Text style={[styles.statusValue, { color: devices.length > 0 ? Colors.accentEmerald : Colors.textMuted }]}>
            {devices.length} device(s)
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Input Bridge</Text>
          <Text style={[styles.statusValue, { color: serverStatus === 'online' ? Colors.accentEmerald : Colors.textMuted }]}>
            {serverStatus === 'online' ? 'Touch + Gesture Ready' : 'Unavailable'}
          </Text>
        </View>
      </View>

      {/* Wireless ADB Connect */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="wifi" size={16} color={Colors.accentCyan} />
          <Text style={styles.cardTitle}>Wireless ADB Pairing</Text>
        </View>
        <Text style={styles.cardSubtitle}>
          Enter your phone IP from Settings → Developer Options → Wireless Debugging
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.ipInput}
            value={wirelessIp}
            onChangeText={setWirelessIp}
            placeholder="192.168.1.50:5555"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numeric"
          />
          <TouchableOpacity onPress={handleWirelessConnect} style={styles.connectButton}>
            <Ionicons name="link" size={16} color="#000" />
            <Text style={styles.connectButtonText}>Connect</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick App Launchers */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="grid" size={16} color={Colors.accentPurple} />
          <Text style={styles.cardTitle}>Quick App Launchers</Text>
        </View>
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.pkg}
              onPress={() => handleQuickAction(action.label, action.pkg)}
              style={styles.quickAction}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name={action.icon} size={20} color={Colors.accentCyan} />
              </View>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Autonomous Goal Dispatcher */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="rocket" size={16} color={Colors.accentAmber} />
          <Text style={styles.cardTitle}>Autonomous Goal Dispatcher</Text>
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.ipInput, { flex: 1 }]}
            value={autonomousGoal}
            onChangeText={setAutonomousGoal}
            placeholder="e.g. 'Launch WhatsApp and send a message'"
            placeholderTextColor={Colors.textMuted}
          />
          <TouchableOpacity
            onPress={executeGoal}
            disabled={isExecuting || !autonomousGoal.trim()}
            style={[styles.connectButton, (isExecuting || !autonomousGoal.trim()) && { opacity: 0.5 }]}
          >
            {isExecuting ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Ionicons name="play" size={16} color="#000" />
            )}
            <Text style={styles.connectButtonText}>{isExecuting ? 'Running...' : 'Execute'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Activity Log */}
      <View style={[styles.card, { flex: 1 }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="terminal" size={16} color={Colors.accentCyan} />
          <Text style={styles.cardTitle}>Action Log</Text>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>
        <View style={styles.logContainer}>
          {logs.map((log) => (
            <View key={log.id} style={styles.logEntry}>
              <View
                style={[
                  styles.logBar,
                  {
                    backgroundColor:
                      log.type === 'success'
                        ? Colors.accentEmerald
                        : log.type === 'error'
                        ? Colors.accentRed
                        : log.type === 'action'
                        ? Colors.accentAmber
                        : Colors.accentCyan,
                  },
                ]}
              />
              <Text style={styles.logText}>{log.text}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: 40,
  },
  // Banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentCyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  bannerSubtitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  hardwareBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: Colors.accentEmerald,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  hardwareBadgeText: {
    color: Colors.accentEmerald,
    fontSize: 9,
    fontWeight: FontWeight.bold,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    backgroundColor: Colors.bgTertiary,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  scanButtonText: {
    color: Colors.accentCyan,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  // Cards
  card: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    flex: 1,
  },
  cardSubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  // Status rows
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  statusLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  statusValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  // Input row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  ipInput: {
    flex: 1,
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.sm,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accentCyan,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radius.sm,
  },
  connectButtonText: {
    color: '#000',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  // Quick actions grid
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  quickAction: {
    alignItems: 'center',
    gap: 6,
    width: 80,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    textAlign: 'center',
  },
  // Live indicator
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accentEmerald,
  },
  liveText: {
    color: Colors.accentEmerald,
    fontSize: 9,
    fontWeight: FontWeight.bold,
  },
  // Logs
  logContainer: {
    gap: 6,
    maxHeight: 240,
  },
  logEntry: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  logBar: {
    width: 2,
    minHeight: 18,
    borderRadius: 1,
    marginTop: 2,
  },
  logText: {
    color: '#cbd5e1',
    fontSize: FontSize.xs,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
    lineHeight: 18,
  },
});
