/**
 * UIAutomator Hierarchy Parser 🌳
 * Parses the real XML produced by `adb shell uiautomator dump` into the
 * PhoneElementNode tree used across OpenBot. The parser is a small,
 * purpose-built XML reader for this known document shape — it preserves the
 * nested node structure and converts `bounds="[x1,y1][x2,y2]"` attributes
 * into { x, y, width, height } rectangles.
 */

import type { PhoneElementNode } from './index.js';

function parseAttributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    attrs[match[1]] = decodeEntities(match[2]);
  }
  return attrs;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseBounds(raw: string | undefined): { x: number; y: number; width: number; height: number } {
  if (!raw) return { x: 0, y: 0, width: 0, height: 0 };
  const match = raw.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!match) return { x: 0, y: 0, width: 0, height: 0 };
  const [x1, y1, x2, y2] = match.slice(1).map(Number);
  return { x: x1, y: y1, width: Math.max(0, x2 - x1), height: Math.max(0, y2 - y1) };
}

let idCounter = 0;

function nodeFromAttrs(attrs: Record<string, string>): PhoneElementNode {
  return {
    id: `node_${idCounter++}`,
    resourceId: attrs['resource-id'] || undefined,
    className: attrs['class'] || '',
    text: attrs['text'] || undefined,
    contentDescription: attrs['content-desc'] || undefined,
    bounds: parseBounds(attrs['bounds']),
    clickable: attrs['clickable'] === 'true',
    scrollable: attrs['scrollable'] === 'true',
    editable:
      attrs['class']?.includes('EditText') === true ||
      (attrs['focusable'] === 'true' && attrs['class']?.includes('Text') === true && attrs['long-clickable'] === 'true'),
    focused: attrs['focused'] === 'true',
    children: [],
  };
}

/**
 * Parse a uiautomator dump document into the root element list
 * (typically a single FrameLayout root with nested children).
 */
export function parseUiautomatorXml(xml: string): PhoneElementNode[] {
  idCounter = 0;
  const roots: PhoneElementNode[] = [];
  const stack: PhoneElementNode[] = [];

  const tagPattern = /<(\/?)([a-zA-Z0-9_.-]+)((?:[^>"']|"[^"]*"|'[^']*')*)(\/?)>/g;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(xml)) !== null) {
    const [, closing, tagName, attrSource, selfClosing] = match;
    if (tagName === 'hierarchy' || tagName === '?xml') {
      if (closing) stack.pop();
      continue;
    }
    if (tagName !== 'node') continue;

    if (closing) {
      stack.pop();
      continue;
    }

    const node = nodeFromAttrs(parseAttributes(attrSource));
    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children = parent.children || [];
      parent.children.push(node);
    } else {
      roots.push(node);
    }
    if (!selfClosing) stack.push(node);
  }

  // Clean up empty children arrays for leaf nodes
  const prune = (nodes: PhoneElementNode[]) => {
    for (const node of nodes) {
      if (node.children && node.children.length === 0) node.children = undefined;
      else if (node.children) prune(node.children);
    }
  };
  prune(roots);
  return roots;
}

/** Flatten a node tree into a single list (parents before children). */
export function flattenNodes(nodes: PhoneElementNode[]): PhoneElementNode[] {
  const flat: PhoneElementNode[] = [];
  const walk = (list: PhoneElementNode[]) => {
    for (const node of list) {
      flat.push(node);
      if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return flat;
}

/** Find the first node whose text or content-description contains the target (case-insensitive). */
export function findNodeByText(nodes: PhoneElementNode[], target: string): PhoneElementNode | undefined {
  const needle = target.toLowerCase();
  for (const node of flattenNodes(nodes)) {
    if (node.text?.toLowerCase().includes(needle)) return node;
    if (node.contentDescription?.toLowerCase().includes(needle)) return node;
  }
  return undefined;
}

/** Center point of a node — the coordinate to tap. */
export function nodeCenter(node: PhoneElementNode): { x: number; y: number } {
  return {
    x: Math.round(node.bounds.x + node.bounds.width / 2),
    y: Math.round(node.bounds.y + node.bounds.height / 2),
  };
}
