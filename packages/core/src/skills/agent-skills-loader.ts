/**
 * AI Agent Skills Repository Loader 🧠📦
 * Dynamically scans, parses, and loads the user's 176+ production-grade AI Agent Skills
 * (from c:\Users\shiva\.gemini\antigravity-ide\scratch\ai-agent-skills or custom path)
 * and registers them into OpenBot's runtime SkillEngine.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Skill, SkillDefinition, SkillStep } from '../types/index.js';

export interface DiscoveredAgentSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  path: string;
  hasSkillMd: boolean;
  instructionsSnippet: string;
}

export class AgentSkillsLoader {
  private defaultSkillsDir: string;

  constructor(customPath?: string) {
    this.defaultSkillsDir =
      customPath ||
      process.env.AGENT_SKILLS_PATH ||
      'c:\\Users\\shiva\\.gemini\\antigravity-ide\\scratch\\ai-agent-skills';
  }

  /**
   * Scan the agent skills repository and return metadata for all found skills.
   */
  scanSkills(repoPath = this.defaultSkillsDir): DiscoveredAgentSkill[] {
    const discovered: DiscoveredAgentSkill[] = [];
    if (!fs.existsSync(repoPath)) {
      return discovered;
    }

    try {
      const entries = fs.readdirSync(repoPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'assets') {
          continue;
        }

        const skillFolder = path.join(repoPath, entry.name);
        const skillMdPath = path.join(skillFolder, 'SKILL.md');
        const hasSkillMd = fs.existsSync(skillMdPath);

        let name = entry.name;
        let description = `Autonomous skill for ${entry.name.replace(/-/g, ' ')}`;
        let category = this.categorizeSkill(entry.name);
        let snippet = '';

        if (hasSkillMd) {
          try {
            const content = fs.readFileSync(skillMdPath, 'utf-8');
            snippet = content.slice(0, 500);

            // Parse YAML frontmatter if present
            if (content.startsWith('---')) {
              const secondDashes = content.indexOf('---', 3);
              if (secondDashes > 3) {
                const frontmatter = content.slice(3, secondDashes);
                const nameMatch = frontmatter.match(/name:\s*([^\n\r]+)/);
                const descMatch = frontmatter.match(/description:\s*([^\n\r]+)/);
                if (nameMatch && nameMatch[1]) name = nameMatch[1].trim();
                if (descMatch && descMatch[1]) description = descMatch[1].trim();
              }
            }
          } catch {
            // Keep defaults
          }
        }

        discovered.push({
          id: `skill_${entry.name}`,
          name,
          description,
          category,
          path: skillFolder,
          hasSkillMd,
          instructionsSnippet: snippet,
        });
      }
    } catch {
      // Directory access issue
    }

    return discovered;
  }

  /**
   * Convert discovered agent skills into OpenBot executable Skill objects
   */
  convertToOpenBotSkills(discoveredList: DiscoveredAgentSkill[]): Skill[] {
    return discoveredList.map((d) => {
      const definition: SkillDefinition = {
        triggers: [
          { type: 'keyword', value: d.name.toLowerCase() },
          { type: 'manual', value: d.id },
        ],
        steps: [
          {
            type: 'prompt',
            content: `[EXPERT SYSTEM CONTEXT - ${d.name.toUpperCase()}]:\n${d.description}\n${d.instructionsSnippet ? `\nGuidance Preview:\n${d.instructionsSnippet.slice(0, 300)}...` : ''}`,
          },
          {
            type: 'tool',
            content: `Execute specialized operations according to ${d.name} standards`,
            toolName: 'generate_content',
            toolInput: {
              prompt: `Follow the engineering guidelines of ${d.name} to complete: {{taskGoal}}`,
            },
          },
        ],
        inputSchema: {
          taskGoal: { type: 'string', description: 'The task objective to solve using this skill' },
        },
      };

      return {
        id: d.id,
        userId: 'system',
        name: d.name,
        description: d.description,
        definition,
        isPublic: true,
        tags: [d.category, 'agent-skill', 'expert-routine'],
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
  }

  private categorizeSkill(folderName: string): string {
    const fn = folderName.toLowerCase();
    if (fn.includes('security') || fn.includes('attack') || fn.includes('reverse') || fn.includes('pentest') || fn.includes('malware') || fn.includes('threat')) {
      return 'Security & Forensics';
    }
    if (fn.includes('bigquery') || fn.includes('gcp') || fn.includes('data') || fn.includes('spark') || fn.includes('dbt')) {
      return 'Cloud & Data Engineering';
    }
    if (fn.includes('loop') || fn.includes('agent') || fn.includes('multi-agent') || fn.includes('superpowers')) {
      return 'Agentic Architecture';
    }
    if (fn.includes('devops') || fn.includes('k8s') || fn.includes('docker') || fn.includes('github') || fn.includes('ci')) {
      return 'DevOps & Infrastructure';
    }
    if (fn.includes('browser') || fn.includes('phone') || fn.includes('ios') || fn.includes('macos')) {
      return 'Device & Automation';
    }
    return 'Engineering Mastery';
  }
}
