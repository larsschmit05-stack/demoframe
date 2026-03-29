import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch demos with screen counts
    const { data: demos, error } = await supabase
      .from('demos')
      .select(`
        *,
        screens(count)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch demos' },
        { status: 500 }
      );
    }

    return NextResponse.json(demos);
  } catch (error) {
    console.error('List demos error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, app_url } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      );
    }

    // Check freemium limit
    const { data: userData } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    if (userData?.subscription_tier === 'free') {
      const { data: countData } = await supabase.rpc(
        'get_active_demo_count',
        { p_user_id: user.id }
      );

      const { FREE_DEMO_LIMIT } = await import('@/lib/constants');
      if (countData >= FREE_DEMO_LIMIT) {
        return NextResponse.json(
          {
            error: `Free plan is limited to ${FREE_DEMO_LIMIT} active demos. Please upgrade to Pro.`,
            upgrade_url: '/dashboard/billing',
          },
          { status: 402 }
        );
      }
    }

    const { data: demo, error: insertError } = await supabase
      .from('demos')
      .insert({
        user_id: user.id,
        name,
        app_url: app_url || null,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to create demo' },
        { status: 500 }
      );
    }

    return NextResponse.json(demo, { status: 201 });
  } catch (error) {
    console.error('Create demo error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
