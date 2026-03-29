import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { STORAGE_BUCKET } from '@/lib/constants';
import type { EmbedPayload } from '@/lib/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (!UUID_REGEX.test(params.id)) {
      return NextResponse.json(
        { error: 'Invalid demo ID' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createServiceClient();

    // Fetch demo
    const { data: demo, error: demoError } = await supabase
      .from('demos')
      .select('id, name, app_url, is_active')
      .eq('id', params.id)
      .single();

    if (demoError || !demo) {
      return NextResponse.json(
        { error: 'Demo not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    if (!demo.is_active) {
      return NextResponse.json(
        { error: 'This demo is no longer available' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Fetch screens
    const { data: screens, error: screensError } = await supabase
      .from('screens')
      .select('id, name, storage_path, sort_order, viewport_width, viewport_height, is_start_screen')
      .eq('demo_id', params.id)
      .order('sort_order', { ascending: true });

    if (screensError || !screens || screens.length === 0) {
      return NextResponse.json(
        { error: 'No screens found for this demo' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Fetch navigation rules
    const { data: rules } = await supabase
      .from('navigation_rules')
      .select('source_screen_id, target_screen_id, trigger_selector, trigger_text')
      .eq('demo_id', params.id);

    // Generate signed URLs for all screens (300s expiry)
    const screensWithUrls = await Promise.all(
      screens.map(async (screen) => {
        const { data: signedUrlData } = await supabase
          .storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(screen.storage_path, 300);

        return {
          id: screen.id,
          name: screen.name,
          sort_order: screen.sort_order,
          viewport_width: screen.viewport_width,
          viewport_height: screen.viewport_height,
          signed_url: signedUrlData?.signedUrl || '',
        };
      })
    );

    // Determine start screen
    const startScreen = screens.find((s) => s.is_start_screen) || screens[0];

    const payload: EmbedPayload = {
      demo: {
        id: demo.id,
        name: demo.name,
        app_url: demo.app_url,
      },
      screens: screensWithUrls,
      navigation_rules: rules || [],
      start_screen_id: startScreen.id,
    };

    return NextResponse.json(payload, {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, s-maxage=60',
      },
    });
  } catch (error) {
    console.error('Embed API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
