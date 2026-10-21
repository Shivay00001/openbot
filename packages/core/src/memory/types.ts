/**
 * OpenBot Memory, Database & Reinforcement Learning Types 🧠💾
 * Multi-tier memory architecture: Working, Episodic, Semantic, and Procedural.
 */

import type { MemoryCategory, Memory } from '../types/index.js';

export interface EpisodicStep {
  stepIndex: number;
  action: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  observation?: unknown;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface EpisodicMemoryEpisode {
  id: string;
  userId: string;
  conversationId: string;
  goal: string;
  steps: EpisodicStep[];
  outcome: 'success' | 'failure' | 'partial';
  summary: string;
  rewardScore: number; // 0.0 to 1.0
  reflectionCritique?: {
    strengths: string[];
    weaknesses: string[];
    lessonsLearned: string[];
  };
  tags: string[];
  embedding?: number[];
  startedAt: number;
  completedAt: number;
}

export interface ProceduralSkillTrajectory {
  id: string;
  name: string;
  description: string;
  triggerPattern: string;
  optimizedSteps: Array<{
    toolName: string;
    inputTemplate: Record<string, unknown>;
    expectedOutcome: string;
  }>;
  successRate: number;
  executionCount: number;
  updatedAt: number;
}

export interface MemoryDatabaseOptions {
  storageType: 'indexeddb' | 'prisma_postgres' | 'in_memory' | 'hybrid';
  dbName?: string;
  cloudSyncEnabled?: boolean;
}

export interface TrajectoryEvaluationResult {
  rewardScore: number; // 0.0 to 1.0
  metrics: {
    completionScore: number;
    efficiencyScore: number;
    safetyScore: number;
    errorPenalty: number;
  };
  critique: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
}
