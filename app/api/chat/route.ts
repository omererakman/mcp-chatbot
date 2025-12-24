import { NextRequest, NextResponse } from 'next/server';
import { MCPClient } from '@/lib/mcp/client';
import { Orchestrator } from '@/lib/openai/orchestrator';
import type { ChatMessage } from '@/lib/openai/types';

// Singleton instances
let mcpClient: MCPClient | null = null;
let orchestrator: Orchestrator | null = null;

// Initialize MCP client and orchestrator
async function getOrchestrator(): Promise<Orchestrator> {
  const serverUrl = process.env.MCP_SERVER_URL;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!serverUrl) {
    throw new Error('MCP_SERVER_URL environment variable is not set');
  }

  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  // Initialize MCP client if needed
  if (!mcpClient) {
    mcpClient = new MCPClient(serverUrl);
    await mcpClient.connect();
  } else if (!mcpClient.isConnected()) {
    await mcpClient.connect();
  }

  // Initialize orchestrator if needed
  if (!orchestrator) {
    orchestrator = new Orchestrator(openaiApiKey, mcpClient);
    await orchestrator.initialize();
  }

  return orchestrator;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages } = body as { messages: ChatMessage[] };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Get orchestrator
    const orch = await getOrchestrator();

    // Model from environment or default to gpt-4o-mini
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    // Orchestrate conversation with OpenAI + MCP
    // The AI will ask for email/PIN when needed for order-related queries
    const result = await orch.orchestrateConversation(messages, model);

    return NextResponse.json({
      message: result.message,
      toolsUsed: result.toolsUsed,
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
