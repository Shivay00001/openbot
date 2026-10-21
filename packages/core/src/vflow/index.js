"use strict";
/**
 * vFlow Voice Command Engine 🎙️⚡
 * Universal voice-to-action graph execution system for OpenBot.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILTIN_VFLOW_WORKFLOWS = exports.vFlowEngine = exports.vFlowCommandParser = void 0;
__exportStar(require("./types.js"), exports);
var parser_js_1 = require("./parser.js");
Object.defineProperty(exports, "vFlowCommandParser", { enumerable: true, get: function () { return parser_js_1.vFlowCommandParser; } });
var engine_js_1 = require("./engine.js");
Object.defineProperty(exports, "vFlowEngine", { enumerable: true, get: function () { return engine_js_1.vFlowEngine; } });
var templates_js_1 = require("./templates.js");
Object.defineProperty(exports, "BUILTIN_VFLOW_WORKFLOWS", { enumerable: true, get: function () { return templates_js_1.BUILTIN_VFLOW_WORKFLOWS; } });
//# sourceMappingURL=index.js.map