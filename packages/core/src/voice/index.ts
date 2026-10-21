/**
 * OpenBot Voice Pipeline & Autonomous Call Agent 🎙️📞
 * Provides:
 * - Autonomous outbound telephony via the Twilio REST API (real calls when
 *   TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER are set;
 *   a clear "not configured" error otherwise — calls are never faked).
 * - Speech synthesis via an OpenAI-compatible /audio/speech endpoint when an
 *   API key is available; otherwise an honest error.
 * - A voice-activity energy detector for raw PCM frames (real math, used by
 *   capture loops in host apps).
 */

export interface VoicePersona {
  id: string;
  name: string;
  gender: 'female' | 'male' | 'neutral';
  accent: string;
  speed: number;
  pitch: number;
  sampleAudioUrl?: string;
}

/** Session shape used by the web Voice UI for in-browser calls. */
export interface ActivePhoneCallSession {
  callId: string;
  recipientNumber: string;
  purpose: string;
  status: 'initiating' | 'ringing' | 'connected' | 'speaking' | 'listening' | 'ivr_navigation' | 'completed' | 'failed';
  durationSeconds: number;
  transcript: Array<{ speaker: 'agent' | 'recipient' | 'ivr'; text: string; timestamp: number }>;
  extractedOutcome?: {
    success: boolean;
    appointmentTime?: string;
    confirmationCode?: string;
    summary: string;
  };
}

export const CURATED_VOICE_PERSONAS: VoicePersona[] = [
  { id: 'nova', name: 'Nova (Warm & Friendly)', gender: 'female', accent: 'American', speed: 1.0, pitch: 1.0 },
  { id: 'echo', name: 'Echo (Calm & Authoritative)', gender: 'male', accent: 'British', speed: 0.95, pitch: 0.9 },
  { id: 'shimmer', name: 'Shimmer (Energetic & Expressive)', gender: 'female', accent: 'American', speed: 1.05, pitch: 1.1 },
  { id: 'fable', name: 'Fable (Gentle & Conversational)', gender: 'male', accent: 'Irish', speed: 1.0, pitch: 1.0 },
];

export interface ActiveVoiceCall {
  callId: string;
  phoneNumber: string;
  status: 'queued' | 'ringing' | 'in-progress' | 'initiating' | 'speaking' | 'listening' | 'completed' | 'failed' | 'error';
  transcript: Array<{ speaker: 'agent' | 'user'; text: string; timestamp: number }>;
  startedAt: number;
  purpose: string;
}

export interface TelephonyConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  /** Public URL Twilio can reach for TwiML instructions. */
  twimlUrl?: string;
}

export class VoicePipelineAgent {
  private activeCalls: Map<string, ActiveVoiceCall> = new Map();
  private readonly telephony: TelephonyConfig | null;

  constructor(telephony?: Partial<TelephonyConfig>) {
    const accountSid = telephony?.accountSid || process.env.TWILIO_ACCOUNT_SID;
    const authToken = telephony?.authToken || process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = telephony?.fromNumber || process.env.TWILIO_PHONE_NUMBER;
    this.telephony =
      accountSid && authToken && fromNumber
        ? { accountSid, authToken, fromNumber, twimlUrl: telephony?.twimlUrl || process.env.TWILIO_TWIML_URL }
        : null;
  }

  /** True when a real telephony provider (Twilio) is configured. */
  get isTelephonyConfigured(): boolean {
    return Boolean(this.telephony);
  }

  /**
   * Energy-based voice activity detection over a mono 16-bit PCM frame.
   * Returns true when the frame's RMS energy exceeds the threshold.
   */
  detectVoiceActivity(pcmSamples: Int16Array, threshold = 0.02): boolean {
    if (pcmSamples.length === 0) return false;
    let sumSquares = 0;
    for (let i = 0; i < pcmSamples.length; i++) {
      const normalized = pcmSamples[i] / 32768;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / pcmSamples.length);
    return rms >= threshold;
  }

  /**
   * Initiate a REAL autonomous outbound phone call through Twilio.
   * Throws when no telephony provider is configured.
   */
  async startAutonomousPhoneCall(phoneNumber: string, purpose: string): Promise<ActiveVoiceCall> {
    if (!this.telephony) {
      throw new Error(
        'Telephony provider not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to place real calls. OpenBot does not simulate phone calls.'
      );
    }
    if (!/^\+?[0-9\s()-]{7,}$/.test(phoneNumber)) {
      throw new Error(`Invalid phone number: "${phoneNumber}"`);
    }

    const { accountSid, authToken, fromNumber, twimlUrl } = this.telephony;
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
    const body = new URLSearchParams({
      To: phoneNumber,
      From: fromNumber,
    });
    if (twimlUrl) {
      body.set('Url', twimlUrl);
    } else {
      body.set(
        'Twiml',
        `<Response><Say voice="alice">Hello, this is OpenBot calling about: ${purpose.replace(/[<>&"]/g, '')}. Please hold while we connect you.</Say></Response>`
      );
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Twilio call creation failed: HTTP ${response.status} ${payload.message || ''}`.trim());
    }

    const call: ActiveVoiceCall = {
      callId: payload.sid,
      phoneNumber,
      status: payload.status === 'queued' ? 'queued' : 'ringing',
      transcript: [{ speaker: 'agent', text: `Call initiated for purpose: ${purpose}`, timestamp: Date.now() }],
      startedAt: Date.now(),
      purpose,
    };
    this.activeCalls.set(call.callId, call);
    return call;
  }

  /** Poll Twilio for the live status of a call placed through this agent. */
  async refreshCallStatus(callId: string): Promise<ActiveVoiceCall | null> {
    const call = this.activeCalls.get(callId);
    if (!call || !this.telephony) return call || null;
    const { accountSid, authToken } = this.telephony;
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callId}.json`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        },
      }
    );
    if (!response.ok) return call;
    const payload: any = await response.json();
    const statusMap: Record<string, ActiveVoiceCall['status']> = {
      queued: 'queued',
      ringing: 'ringing',
      'in-progress': 'in-progress',
      completed: 'completed',
      failed: 'failed',
      busy: 'failed',
      'no-answer': 'failed',
      canceled: 'failed',
    };
    call.status = statusMap[payload.status] || call.status;
    return call;
  }

  getActiveCall(callId: string): ActiveVoiceCall | null {
    return this.activeCalls.get(callId) || null;
  }

  /**
   * Synthesize speech with an OpenAI-compatible audio API.
   * Returns a data URL (audio/mpeg base64). Throws when no speech provider
   * is configured instead of returning a silent placeholder.
   */
  async synthesizeSpeech(
    text: string,
    options?: { apiKey?: string; baseUrl?: string; model?: string; voice?: string }
  ): Promise<string> {
    const apiKey = options?.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('Speech synthesis not configured. Set OPENAI_API_KEY (or pass apiKey) for an OpenAI-compatible /audio/speech endpoint.');
    }
    const baseUrl = (options?.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model || 'tts-1',
        voice: options?.voice || 'alloy',
        input: text,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Speech synthesis failed: HTTP ${response.status} ${detail}`.trim());
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:audio/mpeg;base64,${buffer.toString('base64')}`;
  }
}
