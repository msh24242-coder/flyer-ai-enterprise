export type AgentType =
  | 'DIRECTOR'
  | 'STRATEGY'
  | 'RESEARCH'
  | 'CONTENT'
  | 'SOCIAL'
  | 'PERFORMANCE'
  | 'ANALYTICS'
  | 'CREATIVE';

export type PermissionLevel = 'READ' | 'WRITE' | 'APPROVAL_REQUIRED' | 'ADMIN_ONLY';

export type MemoryType =
  | 'DECISION'
  | 'CAMPAIGN_INSIGHT'
  | 'LEARNED_PREFERENCE'
  | 'GOAL_UPDATE'
  | 'LESSON';

export interface CanonicalMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string | CanonicalContentBlock[];
}

export interface CanonicalContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  toolUseId?: string;
  content?: string;
}

export interface CanonicalTool {
  name: string;
  description: string;
  permissionLevel: PermissionLevel;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}
