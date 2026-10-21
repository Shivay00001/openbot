"use strict";
/**
 * Reinforcement & Self-Improvement Engine (RL / Critique-and-Refine) 🎯🔄
 * Inspired by Reflexion, Self-RAG, and reinforcement learning trajectory optimization.
 *
 * Provides:
 * - Trajectory evaluation and multi-dimensional reward scoring
 * - Critique & reflection extraction from execution logs
 * - Distillation of high-reward episodes into reusable procedural playbooks
 * - Continuous self-improvement across agent sessions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReinforcementLearningEngine = void 0;
const uuid_1 = require("uuid");
class ReinforcementLearningEngine {
    learnedPlaybooks = new Map();
    /**
     * Evaluate an agent task trajectory and calculate reinforcement reward score
     */
    evaluateTrajectory(goal, steps, outcome, maxOptimalSteps = 10) {
        // 1. Completion Score (0.0 to 1.0)
        const completionScore = outcome === 'success' ? 1.0 : outcome === 'partial' ? 0.5 : 0.0;
        // 2. Efficiency Score: optimal step count vs actual steps
        const stepRatio = steps.length <= maxOptimalSteps ? 1.0 : Math.max(0.2, maxOptimalSteps / steps.length);
        const efficiencyScore = Number(stepRatio.toFixed(2));
        // 3. Error Penalty: how many steps threw errors
        const errorCount = steps.filter((s) => !s.success || s.error).length;
        const errorPenalty = Number(Math.min(0.4, (errorCount / (steps.length || 1)) * 0.5).toFixed(2));
        // 4. Safety Score
        const safetyScore = 1.0;
        // Compute composite reward: R = 0.5 * completion + 0.3 * efficiency + 0.2 * safety - errorPenalty
        const rawReward = 0.5 * completionScore + 0.3 * efficiencyScore + 0.2 * safetyScore - errorPenalty;
        const rewardScore = Number(Math.max(0.0, Math.min(1.0, rawReward)).toFixed(2));
        // 5. Generate Critique & Lessons Learned
        const strengths = [];
        const weaknesses = [];
        const recommendations = [];
        if (outcome === 'success') {
            strengths.push(`Successfully completed goal "${goal}" in ${steps.length} steps.`);
        }
        else {
            weaknesses.push(`Failed to fully satisfy goal "${goal}".`);
        }
        if (errorCount === 0) {
            strengths.push('Zero tool execution errors throughout the entire trajectory.');
        }
        else {
            weaknesses.push(`Encountered ${errorCount} tool errors during execution.`);
            recommendations.push('Inspect parameter schemas before invoking external tools to prevent validation failures.');
        }
        if (steps.length > maxOptimalSteps) {
            weaknesses.push(`Step count (${steps.length}) exceeded optimal threshold (${maxOptimalSteps}).`);
            recommendations.push('Decompose the plan into fewer composite actions to reduce context token consumption.');
        }
        else {
            strengths.push('High execution efficiency with compact action sequence.');
        }
        return {
            rewardScore,
            metrics: {
                completionScore,
                efficiencyScore,
                safetyScore,
                errorPenalty,
            },
            critique: {
                strengths,
                weaknesses,
                recommendations,
            },
        };
    }
    /**
     * Distill high-reward trajectory into a permanent procedural skill / playbook
     */
    distillToPlaybook(episode) {
        if (episode.rewardScore < 0.8 || episode.outcome !== 'success') {
            return null; // Only distill proven high-performing trajectories
        }
        const playbook = {
            id: (0, uuid_1.v4)(),
            name: `Optimized: ${episode.goal.slice(0, 40)}`,
            description: `Reinforced procedural playbook distilled from episode ${episode.id}`,
            triggerPattern: episode.goal,
            optimizedSteps: episode.steps.map((s) => ({
                toolName: s.toolName || 'unknown_tool',
                inputTemplate: s.toolInput || {},
                expectedOutcome: String(s.observation || 'Action completed successfully'),
            })),
            successRate: 1.0,
            executionCount: 1,
            updatedAt: Date.now(),
        };
        this.learnedPlaybooks.set(playbook.id, playbook);
        return playbook;
    }
    /**
     * Get all distilled procedural playbooks
     */
    getPlaybooks() {
        return Array.from(this.learnedPlaybooks.values());
    }
}
exports.ReinforcementLearningEngine = ReinforcementLearningEngine;
//# sourceMappingURL=reinforcement-engine.js.map