"use strict";
/**
 * vFlow Voice Command Parser 🗣️🧠
 * Extracts intent, slots, and action parameters from spoken voice utterances.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.vFlowCommandParser = void 0;
const uuid_1 = require("uuid");
class vFlowCommandParser {
    wakeWords = ['hey openbot', 'openbot', 'vflow', 'computer', 'jarvis'];
    /**
     * Process raw spoken audio transcript into a structured vFlowCommand
     */
    parseUtterance(rawTranscript) {
        let cleaned = rawTranscript.trim();
        let detectedWakeWord;
        for (const ww of this.wakeWords) {
            if (cleaned.toLowerCase().startsWith(ww)) {
                detectedWakeWord = ww;
                cleaned = cleaned.substring(ww.length).trim().replace(/^[,:\s]+/, '');
                break;
            }
        }
        return {
            id: (0, uuid_1.v4)(),
            transcript: cleaned,
            confidence: 0.96,
            wakeWordDetected: detectedWakeWord,
            language: 'en-US',
            durationMs: 1500,
            timestamp: Date.now(),
        };
    }
    /**
     * Classify intent and extract slot entities
     */
    classifyIntent(command) {
        const text = command.transcript.toLowerCase();
        // 1. Phone messaging intent: "send message to [target] saying [message]"
        if (text.includes('message') || text.includes('whatsapp') || text.includes('text')) {
            const match = text.match(/(?:send\s+)?(?:message|text|whatsapp)(?:\s+to)?\s+([a-zA-Z0-9\s]+?)\s+(?:saying|that|with)\s+(.+)/i);
            let recipient = match ? match[1].replace(/^to\s+/i, '').trim() : 'Alex';
            recipient = recipient.charAt(0).toUpperCase() + recipient.slice(1);
            const body = match ? match[2].trim() : 'Hello, this is an automated message.';
            return {
                intentName: 'phone_send_message',
                confidence: 0.95,
                slots: { recipient, message: body, app: 'whatsapp' },
                rawCommand: command.transcript,
            };
        }
        // 2. Autonomous Phone Call: "call [target] and [purpose]"
        if (text.startsWith('call ') || text.includes('phone call') || text.includes('dial')) {
            const match = text.match(/call\s+([a-zA-Z0-9\s]+?)(?:\s+(?:and|to|about)\s+(.+))?$/i);
            const target = match ? match[1].trim() : 'Dr. Smith';
            const purpose = match && match[2] ? match[2].trim() : 'Check appointment availability for Friday';
            return {
                intentName: 'phone_make_call',
                confidence: 0.94,
                slots: { target, purpose },
                rawCommand: command.transcript,
            };
        }
        // 3. Browser research & search: "search for [query]" or "open [url]"
        if (text.includes('search') || text.includes('browse') || text.includes('open website')) {
            const match = text.match(/(?:search for|search|browse|open website)\s+(.+)/i);
            const query = match ? match[1].trim() : text;
            return {
                intentName: 'browser_web_search',
                confidence: 0.92,
                slots: { query },
                rawCommand: command.transcript,
            };
        }
        // 4. Desktop OS / Terminal execution: "run command [cmd]" or "terminal [cmd]"
        if (text.includes('run command') || text.includes('terminal') || text.includes('execute')) {
            const match = text.match(/(?:run command|terminal|execute)\s+(.+)/i);
            const commandString = match ? match[1].trim() : 'git status';
            return {
                intentName: 'desktop_execute_command',
                confidence: 0.91,
                slots: { command: commandString },
                rawCommand: command.transcript,
            };
        }
        // Default conversational AI query
        return {
            intentName: 'ai_conversation_query',
            confidence: 0.85,
            slots: { query: command.transcript },
            rawCommand: command.transcript,
        };
    }
}
exports.vFlowCommandParser = vFlowCommandParser;
//# sourceMappingURL=parser.js.map