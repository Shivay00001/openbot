import { NextRequest, NextResponse } from 'next/server';
import { McpComputerServer, SelfOperatingComputerEngine, OpenInterpreterEngine } from '@openbot/core';

const mcpServer = new McpComputerServer();
const selfOperating = new SelfOperatingComputerEngine();
const interpreter = new OpenInterpreterEngine();

export async function GET() {
  try {
    const tools = mcpServer.getMcpToolDefinitions();
    return NextResponse.json({ success: true, tools });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, language, code, tagIndex, displayIndex, toolName, toolArguments } = await req.json();

    // 1. MCP Standard Tool Call
    if (action === 'mcp' && toolName) {
      const response = await mcpServer.handleMcpToolCall({
        id: `call_${Date.now()}`,
        name: toolName,
        arguments: toolArguments || {},
      });
      return NextResponse.json({ success: !response.isError, response });
    }

    // 2. Open Interpreter direct execution
    if (action === 'interpret' && code) {
      const result = await interpreter.execute({
        language: language || 'bash',
        code,
      });
      return NextResponse.json({ success: true, result });
    }

    // 3. Self-Operating Computer Visual Perception
    if (action === 'perceive') {
      const result = await selfOperating.perceiveScreen(displayIndex || 0);
      return NextResponse.json({ success: true, result });
    }

    // 4. Self-Operating Computer Visual Tag Action
    if (action === 'tag_action' && tagIndex !== undefined) {
      const result = await selfOperating.executeTagAction(tagIndex);
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ error: 'Invalid computer action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
