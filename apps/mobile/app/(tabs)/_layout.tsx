/**
 * OpenBot Mobile — Tab Navigator Layout
 * Bottom tab navigation with Chat, Phone, Skills, and Settings tabs.
 */

import { Tabs } from 'expo-router';
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight } from '@/lib/theme';

type TabIconProps = {
  color: string;
  size: number;
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: Colors.bgSecondary,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: Colors.borderSubtle,
        },
        headerTitleStyle: {
          color: Colors.textPrimary,
          fontWeight: FontWeight.bold,
          fontSize: FontSize.lg,
        },
        headerRight: () => (
          <View style={styles.headerBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.headerBadgeText}>Zero-Cloud</Text>
          </View>
        ),
        tabBarStyle: {
          backgroundColor: Colors.bgSecondary,
          borderTopColor: Colors.borderSubtle,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 88,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.accentCyan,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: FontSize.xs,
          fontWeight: FontWeight.semibold,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chat Agent',
          headerTitle: 'OpenBot',
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <Ionicons name="chatbubble-ellipses" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="phone"
        options={{
          title: 'Phone',
          headerTitle: 'Agentic Phone Mode',
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <Ionicons name="phone-portrait" size={size} color={color} />
          ),
          tabBarBadge: 'USP',
          tabBarBadgeStyle: {
            backgroundColor: Colors.accentCyan,
            color: '#000',
            fontSize: 8,
            fontWeight: FontWeight.bold,
          },
        }}
      />
      <Tabs.Screen
        name="skills"
        options={{
          title: 'Skills',
          headerTitle: 'Skills & Routines',
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <Ionicons name="sparkles" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerTitle: 'Settings & BYOK Vault',
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <Ionicons name="settings-sharp" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 16,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accentEmerald,
  },
  headerBadgeText: {
    color: Colors.accentEmerald,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
});
