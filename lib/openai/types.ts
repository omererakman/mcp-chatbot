import type { MCPTool, MCPResource, MCPPrompt } from '../mcp/types';

// OpenAI Chat Message format
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

// OpenAI Tool Call format
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

// OpenAI Function Schema (converted from MCP Tool)
export interface OpenAIFunction {
  name: string;
  description?: string;
  parameters: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

// Orchestration Context (all MCP capabilities)
export interface OrchestrationContext {
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
  functions: OpenAIFunction[];  // Converted tools for OpenAI
  systemPrompt: string;         // Built from resources + prompts
}

// Conversation Request/Response
export interface ConversationRequest {
  messages: ChatMessage[];
}

export interface ConversationResponse {
  message: string;
  toolsUsed?: string[];
}
