-- ============================================================
-- Migration: Create demos, screens, navigation_rules, demo_views tables
-- Replaces: recordings + recording_views (kept for backward compat, not used by new code)
-- ============================================================

-- Create demos table (replaces recordings)
CREATE TABLE public.demos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  app_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  view_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_demos_user_id ON public.demos(user_id);
CREATE INDEX idx_demos_is_active ON public.demos(is_active);
CREATE INDEX idx_demos_created_at ON public.demos(created_at DESC);

CREATE TRIGGER set_demos_updated_at
  BEFORE UPDATE ON public.demos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create screens table (one demo has many screens)
CREATE TABLE public.screens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_id UUID NOT NULL REFERENCES public.demos(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  viewport_width INTEGER NOT NULL DEFAULT 1280,
  viewport_height INTEGER NOT NULL DEFAULT 720,
  thumbnail_path TEXT,
  size_bytes BIGINT DEFAULT 0,
  is_start_screen BOOLEAN NOT NULL DEFAULT false,
  interactive_elements JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_screens_demo_id ON public.screens(demo_id);
CREATE INDEX idx_screens_sort_order ON public.screens(demo_id, sort_order);

-- Create navigation_rules table (wires clicks between screens)
CREATE TABLE public.navigation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_id UUID NOT NULL REFERENCES public.demos(id) ON DELETE CASCADE,
  source_screen_id UUID NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  target_screen_id UUID NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  trigger_selector TEXT NOT NULL,
  trigger_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_navigation_rules_demo_id ON public.navigation_rules(demo_id);
CREATE INDEX idx_navigation_rules_source ON public.navigation_rules(source_screen_id);

-- Create demo_views table (replaces recording_views)
CREATE TABLE public.demo_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_id UUID NOT NULL REFERENCES public.demos(id) ON DELETE CASCADE,
  viewer_ip TEXT,
  viewer_user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_demo_views_demo_id ON public.demo_views(demo_id);
CREATE INDEX idx_demo_views_created_at ON public.demo_views(created_at DESC);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE public.demos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.navigation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_views ENABLE ROW LEVEL SECURITY;

-- Demos: CRUD for own demos
CREATE POLICY "Users can view own demos"
  ON public.demos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own demos"
  ON public.demos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own demos"
  ON public.demos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own demos"
  ON public.demos FOR DELETE
  USING (auth.uid() = user_id);

-- Screens: access through demo ownership
CREATE POLICY "Users can view screens of own demos"
  ON public.screens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.demos
      WHERE demos.id = screens.demo_id
        AND demos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create screens for own demos"
  ON public.screens FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.demos
      WHERE demos.id = screens.demo_id
        AND demos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update screens of own demos"
  ON public.screens FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.demos
      WHERE demos.id = screens.demo_id
        AND demos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete screens of own demos"
  ON public.screens FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.demos
      WHERE demos.id = screens.demo_id
        AND demos.user_id = auth.uid()
    )
  );

-- Navigation rules: access through demo ownership
CREATE POLICY "Users can view navigation rules of own demos"
  ON public.navigation_rules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.demos
      WHERE demos.id = navigation_rules.demo_id
        AND demos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create navigation rules for own demos"
  ON public.navigation_rules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.demos
      WHERE demos.id = navigation_rules.demo_id
        AND demos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete navigation rules of own demos"
  ON public.navigation_rules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.demos
      WHERE demos.id = navigation_rules.demo_id
        AND demos.user_id = auth.uid()
    )
  );

-- Demo views: read for demo owner
CREATE POLICY "Users can view analytics for own demos"
  ON public.demo_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.demos
      WHERE demos.id = demo_views.demo_id
        AND demos.user_id = auth.uid()
    )
  );

-- ============================================================
-- Helper Functions
-- ============================================================

-- Get active demo count for freemium gating
CREATE OR REPLACE FUNCTION public.get_active_demo_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.demos
  WHERE user_id = p_user_id AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER;

-- Increment view count on a demo
CREATE OR REPLACE FUNCTION public.increment_demo_view_count(p_demo_id UUID)
RETURNS VOID AS $$
  UPDATE public.demos
  SET view_count = view_count + 1
  WHERE id = p_demo_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Get screen count for a demo
CREATE OR REPLACE FUNCTION public.get_screen_count(p_demo_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.screens
  WHERE demo_id = p_demo_id;
$$ LANGUAGE sql SECURITY DEFINER;
