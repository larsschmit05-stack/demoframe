-- Create recordings table
CREATE TABLE public.recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  app_url TEXT,
  storage_path TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  view_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_recordings_user_id ON public.recordings(user_id);
CREATE INDEX idx_recordings_is_active ON public.recordings(is_active);
CREATE INDEX idx_recordings_created_at ON public.recordings(created_at DESC);

-- Trigger for updated_at on recordings
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.recordings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
