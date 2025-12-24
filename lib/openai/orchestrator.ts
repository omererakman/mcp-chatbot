import OpenAI from 'openai';
import type { MCPClient } from '../mcp/client';
import type { MCPTool, MCPResource } from '../mcp/types';
import type {
  ChatMessage,
  OpenAIFunction,
  OrchestrationContext,
  ToolCall
} from './types';

export class Orchestrator {
  private openai: OpenAI;
  private mcpClient: MCPClient;
  private context: OrchestrationContext | null = null;

  constructor(openaiApiKey: string, mcpClient: MCPClient) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.mcpClient = mcpClient;
  }

  /**
   * Initialize orchestration context by discovering all MCP capabilities
   */
  async initialize(): Promise<OrchestrationContext> {
    if (this.context) {
      return this.context;
    }

    // Discover all MCP primitives
    const [tools, resources, prompts] = await Promise.all([
      this.mcpClient.listTools(),
      this.mcpClient.listResources(),
      this.mcpClient.listPrompts(),
    ]);

    // Convert MCP tools to OpenAI function schemas
    const functions = this.convertMCPToolsToOpenAIFunctions(tools);

    // Build system prompt incorporating resources and prompts
    const systemPrompt = await this.buildSystemPrompt(resources, prompts);

    this.context = {
      tools,
      resources,
      prompts,
      functions,
      systemPrompt,
    };

    return this.context;
  }

  /**
   * Convert MCP tool schemas to OpenAI function call format
   */
  private convertMCPToolsToOpenAIFunctions(tools: MCPTool[]): OpenAIFunction[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description || `Execute ${tool.name}`,
      parameters: {
        type: 'object',
        properties: tool.inputSchema.properties || {},
        required: tool.inputSchema.required || [],
      },
    }));
  }

  /**
   * Build comprehensive system prompt with MCP resources and prompts
   */
  private async buildSystemPrompt(
    resources: MCPResource[],
    prompts: any[]
  ): Promise<string> {
    let systemPrompt = `You are a helpful customer support agent for a computer products company.

## Your Role
- Help customers find products, check orders, and place new orders
- Always be professional, friendly, and helpful
- Use the available tools to look up real-time data
- Ask for email and PIN to verify customers before accessing their order information

## Available Tools
You have access to the following tools to help customers:
- search_products: Find products by search query
- list_products: Browse product catalog with optional filters
- get_product: Get detailed product information by SKU
- verify_customer_pin: Verify customer identity with email and PIN (required before showing orders)
- get_customer: Get customer information by ID
- list_orders: View customer order history (requires verification first)
- get_order: Get detailed order information
- create_order: Place a new order for a customer

## Important Guidelines
- ALWAYS verify customer identity (email + PIN) before showing order information
- Provide specific product recommendations with SKU, price, and stock information
- Format prices with currency symbols (e.g., $299.99)
- Be transparent about stock levels
- If a customer wants to place an order, verify their identity first
`;

    // Include resource content if available
    if (resources.length > 0) {
      systemPrompt += `\n## Product Knowledge\n`;
      for (const resource of resources.slice(0, 3)) { // Limit to first 3 resources
        try {
          const content = await this.mcpClient.readResource(resource.uri);
          if (content.text) {
            systemPrompt += `\n### ${resource.name}\n${content.text.substring(0, 1000)}\n`;
          }
        } catch (error) {
          console.error(`Failed to read resource ${resource.uri}:`, error);
        }
      }
    }

    return systemPrompt;
  }

  /**
   * Main orchestration loop: handle conversation with tool calling
   */
  async orchestrateConversation(
    messages: ChatMessage[],
    model: string = 'gpt-4o-mini'
  ): Promise<{ message: string; toolsUsed: string[] }> {
    const context = await this.initialize();
    const toolsUsed: string[] = [];

    // Prepare messages with system prompt
    const conversationMessages: ChatMessage[] = [
      { role: 'system', content: context.systemPrompt },
      ...messages,
    ];

    // Iterative loop: max 5 tool call iterations
    let iteration = 0;
    const maxIterations = 5;

    while (iteration < maxIterations) {
      iteration++;

      // Call OpenAI with function calling
      const response = await this.openai.chat.completions.create({
        model,
        messages: conversationMessages as any,
        tools: context.functions.map(f => ({
          type: 'function' as const,
          function: f,
        })),
        tool_choice: 'auto',
      });

      const assistantMessage = response.choices[0].message;

      // If no tool calls, return the final response
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        return {
          message: assistantMessage.content || 'I apologize, but I was unable to generate a response.',
          toolsUsed,
        };
      }

      // Add assistant message to conversation
      conversationMessages.push({
        role: 'assistant',
        content: assistantMessage.content || '',
        tool_calls: assistantMessage.tool_calls as any,
      });

      // Execute tool calls
      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== 'function') {
          continue;
        }
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        toolsUsed.push(toolName);

        try {
          // Execute MCP tool
          const result = await this.mcpClient.callTool(toolName, toolArgs);

          // Add tool result to conversation
          const toolResult = result.content.map(c => c.text || JSON.stringify(c)).join('\n');
          
          conversationMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult,
            name: toolName,
          });
        } catch (error) {
          // Add error message as tool result
          const errorMsg = error instanceof Error ? error.message : 'Tool execution failed';
          conversationMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `Error: ${errorMsg}`,
            name: toolName,
          });
        }
      }
    }

    // If we hit max iterations, return a fallback message
    return {
      message: 'I apologize, but I encountered an issue processing your request. Please try rephrasing your question.',
      toolsUsed,
    };
  }
}
