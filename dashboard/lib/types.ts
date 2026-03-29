export type SubscriptionTier = 'free' | 'pro' | 'team';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  subscription_tier: SubscriptionTier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Demo types (replaces Recording types)
// ============================================================

export interface Demo {
  id: string;
  user_id: string;
  name: string;
  app_url: string | null;
  is_active: boolean;
  view_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Screen {
  id: string;
  demo_id: string;
  name: string;
  source_url: string;
  storage_path: string;
  sort_order: number;
  viewport_width: number;
  viewport_height: number;
  thumbnail_path: string | null;
  size_bytes: number;
  is_start_screen: boolean;
  interactive_elements: InteractiveElement[];
  created_at: string;
}

export interface InteractiveElement {
  selector: string;
  tag: string;
  type: 'button' | 'link' | 'input' | 'toggle' | 'select' | 'tab' | 'other';
  text: string;
  rect: { x: number; y: number; width: number; height: number } | null;
}

export interface NavigationRule {
  id: string;
  demo_id: string;
  source_screen_id: string;
  target_screen_id: string;
  trigger_selector: string;
  trigger_text: string | null;
  created_at: string;
}

export interface DemoView {
  id: string;
  demo_id: string;
  viewer_ip: string | null;
  viewer_user_agent: string | null;
  referrer: string | null;
  created_at: string;
}

// ============================================================
// Embed payload (returned by /api/embed/[id])
// ============================================================

export interface EmbedPayload {
  demo: Pick<Demo, 'id' | 'name' | 'app_url'>;
  screens: Array<Pick<Screen, 'id' | 'name' | 'sort_order' | 'viewport_width' | 'viewport_height'> & {
    signed_url: string;
  }>;
  navigation_rules: Array<Pick<NavigationRule, 'source_screen_id' | 'target_screen_id' | 'trigger_selector' | 'trigger_text'>>;
  start_screen_id: string;
}

// ============================================================
// Legacy types (kept for backward compat during migration)
// ============================================================

/** @deprecated */
export interface RecordingMetadataFields {
  eventCount?: number;
  elementCount?: number;
  sizeBytes?: number;
  duration?: number;
}

/** @deprecated Use Demo instead */
export interface Recording {
  id: string;
  user_id: string;
  name: string;
  app_url: string | null;
  storage_path: string;
  is_active: boolean;
  view_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** @deprecated Use DemoView instead */
export interface RecordingView {
  id: string;
  recording_id: string;
  viewer_ip: string | null;
  viewer_user_agent: string | null;
  referrer: string | null;
  created_at: string;
}
