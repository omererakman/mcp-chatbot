import { NextRequest, NextResponse } from 'next/server';
import { MCPClient } from '@/lib/mcp/client';

// Singleton client instance (shared with chat route)
let mcpClient: MCPClient | null = null;

async function getConnectedClient(): Promise<MCPClient> {
  const serverUrl = process.env.MCP_SERVER_URL;

  if (!serverUrl) {
    throw new Error('MCP_SERVER_URL environment variable is not set');
  }

  if (!mcpClient) {
    mcpClient = new MCPClient(serverUrl);
    await mcpClient.connect();
  } else if (!mcpClient.isConnected()) {
    await mcpClient.connect();
  }

  return mcpClient;
}

export async function GET(request: NextRequest) {
  try {
    const client = await getConnectedClient();

    // Get all capabilities
    const [tools, resources, prompts] = await Promise.all([
      client.listTools(),
      client.listResources(),
      client.listPrompts(),
    ]);

    return NextResponse.json({
      tools,
      resources,
      prompts,
    });
  } catch (error) {
    console.error('Error in tools API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
