/**
 * vFlow Voice Command & Workflow Engine Types 🎙️⚡
 * Universal voice-to-action graph execution system.
 */

export type vFlowNodeType =
  | 'trigger_voice'
  | 'trigger_hotword'
  | 'intent_classifier'
  | 'action_phone'
  | 'action_browser'
  | 'action_desktop'
  | 'action_terminal'
  | 'ai_inference'
  | 'decision_condition'
  | 'voice_tts_output'
  | 'webhook';

export interface vFlowCommand {
  id: string;
  transcript: string;
  confidence: number;
  wakeWordDetected?: string;
  language: string;
  durationMs: number;
  timestamp: number;
}

export interface vFlowIntent {
  intentName: string;
  confidence: number;
  slots: Record<string, string>;
  rawCommand: string;
}

export interface vFlowNode {
  id: string;
  type: vFlowNodeType;
  label: string;
  config: Record<string, unknown>;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
}

export interface vFlowEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  condition?: string; // Optional JavaScript expression for branching
}

export interface vFlowWorkflow {
  id: string;
  name: string;
  description: string;
  triggerPhrases: string[];
  nodes: vFlowNode[];
  edges: vFlowEdge[];
  isBuiltin: boolean;
  createdAt: number;
}

export interface vFlowExecutionStep {
  nodeId: string;
  nodeType: vFlowNodeType;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  input: unknown;
  output: unknown;
  durationMs: number;
  error?: string;
}

export interface vFlowExecutionSession {
  sessionId: string;
  workflowId: string;
  command: vFlowCommand;
  intent?: vFlowIntent;
  status: 'idle' | 'listening' | 'processing' | 'executing' | 'speaking' | 'completed' | 'failed';
  steps: vFlowExecutionStep[];
  spokenFeedback?: string;
  variables: Record<string, unknown>;
  durationMs: number;
}
