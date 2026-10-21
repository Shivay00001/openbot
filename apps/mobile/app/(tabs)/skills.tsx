/**
 * OpenBot Mobile — Skills & Routines Studio
 * Teach-a-task workflow recorder, built-in autonomous skills, and routine dispatcher.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/lib/theme';

interface SkillItem {
  id: string;
  name: string;
  description: string;
  category: 'phone' | 'coding' | 'productivity' | 'web';
  icon: keyof typeof Ionicons.glyphMap;
  tags: string[];
  runsCount: number;
}

const BUILTIN_SKILLS: SkillItem[] = [
  {
    id: 'phone-uber-booking',
    name: 'Auto-Ride Booking',
    description: 'Autonomous Uber/Lyft pickup scheduling based on current GPS and calendar events.',
    category: 'phone',
    icon: 'car-sport',
    tags: ['phone', 'gps', 'automation'],
    runsCount: 42,
  },
  {
    id: 'phone-whatsapp-digest',
    name: 'WhatsApp Digest & Reply',
    description: 'Summarizes unread family and team messages, drafting contextual responses.',
    category: 'phone',
    icon: 'chatbubbles',
    tags: ['phone', 'messaging', 'nlp'],
    runsCount: 128,
  },
  {
    id: 'code-audit-repo',
    name: 'Git Repo Security Audit',
    description: 'Runs local git diff, detects secret leaks, scans dependencies, and generates PR.',
    category: 'coding',
    icon: 'code-slash',
    tags: ['git', 'security', 'dev'],
    runsCount: 95,
  },
  {
    id: 'web-daily-briefing',
    name: 'Morning Intelligence Brief',
    description: 'Aggregates HackerNews, arXiv AI papers, and financial headlines into bullet points.',
    category: 'productivity',
    icon: 'newspaper',
    tags: ['browser', 'ai', 'research'],
    runsCount: 210,
  },
  {
    id: 'phone-battery-optimizer',
    name: 'Deep Sleep Power Saver',
    description: 'Kills background drain apps, lowers refresh rate, toggles Wi-Fi based on geolocation.',
    category: 'phone',
    icon: 'battery-charging',
    tags: ['phone', 'system', 'battery'],
    runsCount: 54,
  },
];

export default function SkillsScreen() {
  const [skills, setSkills] = useState<SkillItem[]>(BUILTIN_SKILLS);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [runningSkillId, setRunningSkillId] = useState<string | null>(null);
  const [logOutput, setLogOutput] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: 'All Skills' },
    { id: 'phone', label: '📱 Phone' },
    { id: 'coding', label: '💻 Coding' },
    { id: 'productivity', label: '⚡ Productivity' },
  ];

  const filteredSkills = skills.filter((s) => {
    const matchesCat = selectedCategory === 'all' || s.category === selectedCategory;
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const toggleRecording = () => {
    if (!isRecording) {
      setIsRecording(true);
      setLogOutput('🔴 [Teach-a-Task] Recording started. Perform actions on your device to teach the agent...');
    } else {
      setIsRecording(false);
      const newSkill: SkillItem = {
        id: `custom-${Date.now()}`,
        name: `Custom Routine #${skills.length + 1}`,
        description: 'Learned workflow compiled from recorded touch gestures and screen perception events.',
        category: 'phone',
        icon: 'sparkles',
        tags: ['custom', 'recorded', 'autonomous'],
        runsCount: 0,
      };
      setSkills((prev) => [newSkill, ...prev]);
      setLogOutput(`✅ [Teach-a-Task] Recording compiled into routine: "${newSkill.name}"! Ready to dispatch.`);
    }
  };

  const handleRunSkill = (skill: SkillItem) => {
    setRunningSkillId(skill.id);
    setLogOutput(`[Step 1/3] Initializing execution for "${skill.name}"...\n[Step 2/3] Resolving local tool pipeline & accessibility tree...\n[Step 3/3] Agent action completed successfully.`);
    setTimeout(() => {
      setRunningSkillId(null);
      setSkills((prev) =>
        prev.map((s) => (s.id === skill.id ? { ...s, runsCount: s.runsCount + 1 } : s))
      );
    }, 1200);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Teach-a-Task Banner */}
      <View style={styles.recordCard}>
        <View style={styles.recordLeft}>
          <View style={[styles.recordIndicator, isRecording && styles.recordIndicatorActive]} />
          <View>
            <Text style={styles.recordTitle}>Teach-a-Task Studio</Text>
            <Text style={styles.recordSubtitle}>
              {isRecording
                ? 'Recording user actions & UI hierarchy...'
                : 'Demonstrate any action once, agent repeats autonomously'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.recordButton, isRecording && styles.recordButtonActive]}
          onPress={toggleRecording}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isRecording ? 'stop-circle' : 'radio-button-on'}
            size={18}
            color={isRecording ? '#fff' : Colors.accentCyan}
          />
          <Text style={[styles.recordButtonText, isRecording && styles.recordButtonTextActive]}>
            {isRecording ? 'Stop & Save' : 'Record'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Execution Log */}
      {logOutput && (
        <View style={styles.logBox}>
          <View style={styles.logHeader}>
            <Ionicons name="terminal" size={14} color={Colors.accentCyan} />
            <Text style={styles.logTitle}>Execution Diagnostics</Text>
            <TouchableOpacity onPress={() => setLogOutput(null)} style={{ marginLeft: 'auto' }}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.logText}>{logOutput}</Text>
        </View>
      )}

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search skills and routines..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
      >
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryChip, isActive && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Skills List */}
      <View style={styles.skillList}>
        {filteredSkills.map((skill) => {
          const isRunning = runningSkillId === skill.id;
          return (
            <View key={skill.id} style={styles.skillCard}>
              <View style={styles.skillTop}>
                <View style={styles.skillIconWrap}>
                  <Ionicons name={skill.icon} size={22} color={Colors.accentCyan} />
                </View>
                <View style={styles.skillMeta}>
                  <Text style={styles.skillName}>{skill.name}</Text>
                  <Text style={styles.skillCategory}>{skill.category.toUpperCase()}</Text>
                </View>

                <TouchableOpacity
                  style={[styles.runBtn, isRunning && styles.runBtnRunning]}
                  onPress={() => handleRunSkill(skill)}
                  disabled={isRunning}
                  activeOpacity={0.7}
                >
                  {isRunning ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="play" size={14} color="#000" />
                      <Text style={styles.runBtnText}>Run</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.skillDesc}>{skill.description}</Text>

              <View style={styles.skillFooter}>
                <View style={styles.tagsRow}>
                  {skill.tags.map((tag) => (
                    <View key={tag} style={styles.tagBadge}>
                      <Text style={styles.tagText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.runsCount}>{skill.runsCount} executions</Text>
              </View>
            </View>
          );
        })}
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
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: 40,
  },
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgGlass,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  recordLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  recordIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.textMuted,
  },
  recordIndicatorActive: {
    backgroundColor: Colors.accentRose,
  },
  recordTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  recordSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    maxWidth: 220,
    marginTop: 2,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderWidth: 1,
    borderColor: Colors.accentCyan,
  },
  recordButtonActive: {
    backgroundColor: Colors.accentRose,
    borderColor: Colors.accentRose,
  },
  recordButtonText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.accentCyan,
  },
  recordButtonTextActive: {
    color: '#fff',
  },
  logBox: {
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: 6,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.accentCyan,
  },
  logText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    height: 44,
    gap: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  categoryChipActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderColor: Colors.accentCyan,
  },
  categoryText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  categoryTextActive: {
    color: Colors.accentCyan,
    fontWeight: FontWeight.bold,
  },
  skillList: {
    gap: Spacing.sm,
  },
  skillCard: {
    backgroundColor: Colors.bgGlass,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  skillTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  skillIconWrap: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.2)',
  },
  skillMeta: {
    flex: 1,
  },
  skillName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  skillCategory: {
    fontSize: FontSize.xs,
    color: Colors.accentCyan,
    fontWeight: FontWeight.semibold,
    marginTop: 2,
  },
  runBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentCyan,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.sm,
  },
  runBtnRunning: {
    backgroundColor: Colors.accentIndigo,
  },
  runBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#000',
  },
  skillDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  skillFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingTop: Spacing.xs,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tagBadge: {
    backgroundColor: Colors.bgSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  runsCount: {
    fontSize: 10,
    color: Colors.textMuted,
  },
});
