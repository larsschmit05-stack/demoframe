-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_views ENABLE ROW LEVEL SECURITY;

-- Users: select own row
CREATE POLICY "Users can view own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Users: update own row
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id);

-- Recordings: select own
CREATE POLICY "Users can view own recordings"
  ON public.recordings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Recordings: insert own
CREATE POLICY "Users can create own recordings"
  ON public.recordings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Recordings: update own
CREATE POLICY "Users can update own recordings"
  ON public.recordings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Recordings: delete own
CREATE POLICY "Users can delete own recordings"
  ON public.recordings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Recording views: select for recording owner
CREATE POLICY "Users can view analytics for own recordings"
  ON public.recording_views
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.recordings
      WHERE recordings.id = recording_views.recording_id
        AND recordings.user_id = auth.uid()
    )
  );
