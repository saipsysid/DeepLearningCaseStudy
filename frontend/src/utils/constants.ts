/** ─────────────────────────────────────────
 *  constants.ts
 *  App-wide constants for the Blinkit Support
 *  ────────────────────────────────────────── */

export const INTENTS = [
  { id: 'order_tracking',    label: 'Order Tracking',    icon: '📦', color: '#3B82F6' },
  { id: 'refund_request',    label: 'Refund Request',    icon: '💰', color: '#EF4444' },
  { id: 'complaint',         label: 'Complaint',         icon: '😡', color: '#F97316' },
  { id: 'delivery_issue',    label: 'Delivery Issue',    icon: '🚚', color: '#8B5CF6' },
  { id: 'payment_issue',     label: 'Payment Issue',     icon: '💳', color: '#EC4899' },
  { id: 'account_issue',     label: 'Account Issue',     icon: '👤', color: '#14B8A6' },
  { id: 'product_inquiry',   label: 'Product Inquiry',   icon: '🛍️', color: '#F9C22E' },
  { id: 'cancel_order',      label: 'Cancel Order',      icon: '❌', color: '#6B7280' },
  { id: 'general_inquiry',   label: 'General Inquiry',   icon: '❓', color: '#A0A0A0' },
  { id: 'escalation',        label: 'Escalation',        icon: '⚠️', color: '#EF4444' },
] as const

export const QUICK_QUESTIONS = [
  'Where is my order?',
  'I need a refund for my last order',
  'My delivery is late, what should I do?',
  'How do I cancel my order?',
  'I was charged twice for my order',
  'The item I received was damaged',
  'How long does delivery usually take?',
  'I want to change my delivery address',
] as const

export const AGENT_STEPS = [
  { id: 'intent',     label: 'Analyzing intent',         icon: '🧠', duration: 800  },
  { id: 'knowledge',  label: 'Searching knowledge base', icon: '🔍', duration: 1200 },
  { id: 'image',      label: 'Analyzing image',          icon: '🖼️', duration: 1000 },
  { id: 'sentiment',  label: 'Detecting sentiment',      icon: '💭', duration: 600  },
  { id: 'routing',    label: 'Routing to agent',         icon: '🔀', duration: 400  },
  { id: 'generating', label: 'Generating response',      icon: '✍️', duration: 500  },
] as const

export const API_ENDPOINTS = {
  CHAT:         '/api/chat',
  CHAT_HISTORY: '/api/chat/history',
  ANALYTICS:    '/api/analytics',
  TICKETS:      '/api/tickets',
  UPLOAD:       '/api/upload',
  HELP_SEARCH:  '/api/help/search',
  HELP_ARTICLES:'/api/help/articles',
  AGENTS:       '/api/agents',
  STATUS:       '/api/status',
} as const

export const SENTIMENT_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  positive: { label: 'Positive', emoji: '😊', color: '#00A651' },
  neutral:  { label: 'Neutral',  emoji: '😐', color: '#A0A0A0' },
  negative: { label: 'Negative', emoji: '😟', color: '#EF4444' },
  angry:    { label: 'Angry',    emoji: '😡', color: '#DC2626' },
}

export const MAX_MESSAGE_LENGTH = 500
export const MAX_IMAGE_SIZE_MB  = 5
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const BLINKIT_CATEGORIES = [
  { id: 'orders',   label: 'Orders',   icon: '📦', description: 'Track, modify, or cancel orders'    },
  { id: 'payments', label: 'Payments', icon: '💳', description: 'Billing, charges, and payment issues' },
  { id: 'refunds',  label: 'Refunds',  icon: '💰', description: 'Refund status and requests'         },
  { id: 'delivery', label: 'Delivery', icon: '🚚', description: 'Delivery time, location, and agents'  },
  { id: 'account',  label: 'Account',  icon: '👤', description: 'Profile, address, and preferences'   },
] as const
