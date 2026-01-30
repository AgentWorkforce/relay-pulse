export interface MessageData {
  fromEntityType?: string;
  _channelMembership?: {
    member: string;
    action: string;
  };
  [key: string]: unknown;
}

export interface Message {
  id: string;
  ts: number;
  from: string;
  to: string;
  kind: string;
  body: string;
  data?: MessageData;
  status: string;
  is_urgent: boolean;
  is_broadcast: boolean;
  deliverySeq?: number;
  deliverySessionId?: string;
  sessionId?: string;
}

export interface RawEntry {
  type: 'message' | 'status';
  message?: Message;
  id?: string;
  status?: string;
  ts?: number;
}

const AGENT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#6366F1', // indigo
];

export function parseMessages(jsonlContent: string): Message[] {
  const lines = jsonlContent.trim().split('\n');
  const messages: Message[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const entry: RawEntry = JSON.parse(line);

      if (entry.type === 'message' && entry.message) {
        const msg = entry.message;

        // Filter out __system__ messages
        if (msg.from === '__system__') continue;

        messages.push(msg);
      }
    } catch (e) {
      console.warn('Failed to parse line:', line.substring(0, 100));
    }
  }

  // Sort by timestamp ascending
  messages.sort((a, b) => a.ts - b.ts);

  // Deduplicate by id (keep first occurrence)
  const seen = new Set<string>();
  const unique: Message[] = [];
  for (const msg of messages) {
    if (!seen.has(msg.id)) {
      seen.add(msg.id);
      unique.push(msg);
    }
  }

  return unique;
}

export function getAgentColors(messages: Message[]): Map<string, string> {
  const agents = new Set<string>();

  for (const msg of messages) {
    agents.add(msg.from);
    if (!msg.to.startsWith('#')) {
      agents.add(msg.to);
    }
  }

  const colorMap = new Map<string, string>();
  const agentList = Array.from(agents).sort();

  agentList.forEach((agent, index) => {
    colorMap.set(agent, AGENT_COLORS[index % AGENT_COLORS.length]);
  });

  return colorMap;
}
