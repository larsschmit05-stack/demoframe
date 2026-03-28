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

export interface RecordingMetadataFields {
  eventCount?: number;
  elementCount?: number;
  sizeBytes?: number;
  duration?: number;
}

export interface RecordingView {
  id: string;
  recording_id: string;
  viewer_ip: string | null;
  viewer_user_agent: string | null;
  referrer: string | null;
  created_at: string;
}
