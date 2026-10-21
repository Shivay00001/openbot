/**
 * vFlow Pre-Built Production Templates ⚡
 * Real-world voice workflows inspired by GrokBot, Fo, Manus, Cue, and Instinct.
 */

import type { vFlowWorkflow } from './types.js';

export const BUILTIN_VFLOW_WORKFLOWS: vFlowWorkflow[] = [
  {
    id: 'vflow_phone_quick_msg',
    name: 'Voice to Phone Message',
    description: 'Dictate a voice message that automatically launches WhatsApp or SMS, selects the recipient, types, and sends.',
    triggerPhrases: ['send message to', 'text', 'whatsapp'],
    isBuiltin: true,
    createdAt: Date.now(),
    nodes: [
      { id: 'n1', type: 'trigger_voice', label: 'Spoken Command', config: {} },
      { id: 'n2', type: 'intent_classifier', label: 'Extract Recipient & Body', config: {} },
      { id: 'n3', type: 'action_phone', label: 'Dispatch on Phone', config: { app: 'whatsapp' } },
      { id: 'n4', type: 'voice_tts_output', label: 'Audio Confirmation', config: {} },
    ],
    edges: [
      { id: 'e1', fromNodeId: 'n1', toNodeId: 'n2' },
      { id: 'e2', fromNodeId: 'n2', toNodeId: 'n3' },
      { id: 'e3', fromNodeId: 'n3', toNodeId: 'n4' },
    ],
  },
  {
    id: 'vflow_autonomous_appointment_call',
    name: 'Autonomous Phone Appointment Booker (Fo / Grok style)',
    description: 'Instruct the agent by voice to place a live phone call to a doctor, restaurant, or business, converse with reception, and confirm time.',
    triggerPhrases: ['call', 'book appointment with', 'reserve table at'],
    isBuiltin: true,
    createdAt: Date.now(),
    nodes: [
      { id: 'n1', type: 'trigger_voice', label: 'Spoken Booking Request', config: {} },
      { id: 'n2', type: 'action_phone', label: 'Initiate Telephony Call Session', config: {} },
      { id: 'n3', type: 'ai_inference', label: 'Duplex Reception Dialogue', config: {} },
      { id: 'n4', type: 'voice_tts_output', label: 'Outcome Notification', config: {} },
    ],
    edges: [
      { id: 'e1', fromNodeId: 'n1', toNodeId: 'n2' },
      { id: 'e2', fromNodeId: 'n2', toNodeId: 'n3' },
      { id: 'e3', fromNodeId: 'n3', toNodeId: 'n4' },
    ],
  },
  {
    id: 'vflow_web_research_briefing',
    name: 'Cross-Browser Research & Voice Briefing (Manus / Hark style)',
    description: 'Command research on any topic; the agent opens parallel browser tabs, scrapes pages, synthesizes notes, and reads an executive summary.',
    triggerPhrases: ['research', 'search web for', 'give me a briefing on'],
    isBuiltin: true,
    createdAt: Date.now(),
    nodes: [
      { id: 'n1', type: 'trigger_voice', label: 'Voice Prompt', config: {} },
      { id: 'n2', type: 'action_browser', label: 'Multi-Tab Search & Extract', config: {} },
      { id: 'n3', type: 'ai_inference', label: 'Synthesize Executive Bullet Points', config: {} },
      { id: 'n4', type: 'voice_tts_output', label: 'Speak Summary', config: {} },
    ],
    edges: [
      { id: 'e1', fromNodeId: 'n1', toNodeId: 'n2' },
      { id: 'e2', fromNodeId: 'n2', toNodeId: 'n3' },
      { id: 'e3', fromNodeId: 'n3', toNodeId: 'n4' },
    ],
  },
];
