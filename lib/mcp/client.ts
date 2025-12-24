// MCP Client configuration and connection logic
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  MCPTool,
  MCPToolCallResult,
  MCPResource,
  MCPResourceContent,
  MCPPrompt,
  MCPPromptMessage,
  MCPSession
} from './types';

export class MCPClient {
  private serverUrl: string;
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private session: MCPSession = { isConnected: false };

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  async connect(): Promise<void> {
    try {
      // Create the client
      this.client = new Client({
        name: 'customer-support-chatbot',
        version: '1.0.0',
      }, {
        capabilities: {}
      });

      // Create Streamable HTTP transport
      const url = new URL(this.serverUrl);
      this.transport = new StreamableHTTPClientTransport(url);

      // Connect to the server
      await this.client.connect(this.transport);

      this.session.isConnected = true;
      console.log('Connected to MCP server:', this.serverUrl);
    } catch (error) {
      this.session.isConnected = false;
      console.error('Failed to connect to MCP server:', error);
      throw new Error(`MCP connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
        this.transport = null;
        this.session.isConnected = false;
        console.log('Disconnected from MCP server');
      }
    } catch (error) {
      console.error('Error disconnecting from MCP server:', error);
      throw new Error(`Disconnect failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listTools(): Promise<MCPTool[]> {
    if (!this.client || !this.session.isConnected) {
      throw new Error('Not connected to MCP server. Call connect() first.');
    }

    try {
      const response = await this.client.listTools();
      return response.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as {
          type: string;
          properties?: Record<string, unknown>;
          required?: string[];
        }
      }));
    } catch (error) {
      console.error('Error listing tools:', error);
      throw new Error(`Failed to list tools: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listResources(): Promise<MCPResource[]> {
    if (!this.client || !this.session.isConnected) {
      throw new Error('Not connected to MCP server. Call connect() first.');
    }

    try {
      const response = await this.client.listResources();
      return response.resources.map(resource => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType
      }));
    } catch (error) {
      console.error('Error listing resources:', error);
      throw new Error(`Failed to list resources: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listPrompts(): Promise<MCPPrompt[]> {
    if (!this.client || !this.session.isConnected) {
      throw new Error('Not connected to MCP server. Call connect() first.');
    }

    try {
      const response = await this.client.listPrompts();
      return response.prompts.map(prompt => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments
      }));
    } catch (error) {
      console.error('Error listing prompts:', error);
      throw new Error(`Failed to list prompts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async callTool(toolName: string, args: Record<string, unknown> = {}): Promise<MCPToolCallResult> {
    if (!this.client || !this.session.isConnected) {
      throw new Error('Not connected to MCP server. Call connect() first.');
    }

    try {
      const response = await this.client.callTool({
        name: toolName,
        arguments: args
      });

      const content = Array.isArray(response.content) ? response.content : [];
      return {
        content: content.map((item: any) => ({
          type: item.type,
          text: 'text' in item ? item.text : undefined,
          ...item
        })),
        isError: response.isError === true
      };
    } catch (error) {
      console.error(`Error calling tool "${toolName}":`, error);
      throw new Error(`Tool call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async readResource(uri: string): Promise<MCPResourceContent> {
    if (!this.client || !this.session.isConnected) {
      throw new Error('Not connected to MCP server. Call connect() first.');
    }

    try {
      const response = await this.client.readResource({ uri });
      const content = response.contents[0];

      return {
        uri: content.uri,
        mimeType: content.mimeType,
        text: 'text' in content ? content.text : undefined,
        blob: 'blob' in content ? content.blob : undefined
      };
    } catch (error) {
      console.error(`Error reading resource "${uri}":`, error);
      throw new Error(`Resource read failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getPrompt(promptName: string, args?: Record<string, string>): Promise<MCPPromptMessage[]> {
    if (!this.client || !this.session.isConnected) {
      throw new Error('Not connected to MCP server. Call connect() first.');
    }

    try {
      const response = await this.client.getPrompt({
        name: promptName,
        arguments: args
      });

      return response.messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));
    } catch (error) {
      console.error(`Error getting prompt "${promptName}":`, error);
      throw new Error(`Prompt retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  isConnected(): boolean {
    return this.session.isConnected;
  }
}
