-- Create recording_views table
CREATE TABLE public.recording_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES public.recordings(id) ON DELETE CASCADE,
  viewer_ip TEXT,
  viewer_user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_recording_views_recording_id ON public.recording_views(recording_id);
CREATE INDEX idx_recording_views_created_at ON public.recording_views(created_at DESC);
