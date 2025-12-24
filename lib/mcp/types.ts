// Type definitions for MCP server communication

export interface MCPMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface MCPRequest {
  messages: MCPMessage[];
  stream?: boolean;
}

export interface MCPResponse {
  message: string;
  metadata?: Record<string, unknown>;
}

// MCP Tool Types
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPToolCallResult {
  content: Array<{
    type: string;
    text?: string;
    [key: string]: unknown;
  }>;
  isError?: boolean;
}

// MCP Resource Types
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

// MCP Prompt Types
export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPPromptMessage {
  role: 'user' | 'assistant';
  content: {
    type: string;
    text?: string;
    [key: string]: unknown;
  };
}

// Error Types
export interface MCPError {
  code: string;
  message: string;
  data?: unknown;
}

// Session Types
export interface MCPSession {
  sessionId?: string;
  isConnected: boolean;
}
