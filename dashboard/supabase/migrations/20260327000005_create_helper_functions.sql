-- Function to get active recording count for a user
CREATE OR REPLACE FUNCTION public.get_active_recording_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.recordings
  WHERE user_id = p_user_id AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to increment view count on a recording
CREATE OR REPLACE FUNCTION public.increment_view_count(p_recording_id UUID)
RETURNS VOID AS $$
  UPDATE public.recordings
  SET view_count = view_count + 1
  WHERE id = p_recording_id;
$$ LANGUAGE sql SECURITY DEFINER;
