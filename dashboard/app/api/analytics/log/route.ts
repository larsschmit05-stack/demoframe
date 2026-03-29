import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { demo_id } = body;

    if (!demo_id) {
      return NextResponse.json(
        { error: 'Missing required field: demo_id' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Validate the demo exists
    const { data: demo, error: fetchError } = await supabase
      .from('demos')
      .select('id')
      .eq('id', demo_id)
      .single();

    if (fetchError || !demo) {
      return NextResponse.json(
        { error: 'Demo not found' },
        { status: 404 }
      );
    }

    // Extract viewer info
    const viewer_ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;
    const viewer_user_agent = request.headers.get('user-agent') || null;
    const referrer = request.headers.get('referer') || null;

    // Insert view record
    const { error: insertError } = await supabase
      .from('demo_views')
      .insert({
        demo_id,
        viewer_ip,
        viewer_user_agent,
        referrer,
      });

    if (insertError) {
      console.error('Failed to insert view:', insertError);
      return NextResponse.json(
        { error: 'Failed to log view' },
        { status: 500 }
      );
    }

    // Increment the view count
    const { error: rpcError } = await supabase.rpc(
      'increment_demo_view_count',
      { p_demo_id: demo_id }
    );

    if (rpcError) {
      console.error('Failed to increment view count:', rpcError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analytics log error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
