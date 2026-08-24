export type CanonicalRole = 'user' | 'assistant';

export interface CanonicalTextBlock {
  type: 'text';
  text: string;
}

export interface CanonicalToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface CanonicalToolResultBlock {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError?: boolean;
}

export type CanonicalContentBlock = CanonicalTextBlock | CanonicalToolUseBlock | CanonicalToolResultBlock;

export interface CanonicalMessage {
  role: CanonicalRole;
  content: CanonicalContentBlock[];
}

export interface CanonicalToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  properties?: Record<string, CanonicalToolParameter>;
  required?: string[];
  items?: CanonicalToolParameter;
}

export interface CanonicalTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, CanonicalToolParameter>;
    required?: string[];
  };
}
