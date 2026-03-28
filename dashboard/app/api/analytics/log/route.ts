import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { recording_id } = body;

    if (!recording_id) {
      return NextResponse.json(
        { error: 'Missing required field: recording_id' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Validate the recording exists
    const { data: recording, error: fetchError } = await supabase
      .from('recordings')
      .select('id')
      .eq('id', recording_id)
      .single();

    if (fetchError || !recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    // Extract viewer info from request headers
    const viewer_ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;
    const viewer_user_agent = request.headers.get('user-agent') || null;
    const referrer = request.headers.get('referer') || null;

    // Insert view record
    const { error: insertError } = await supabase
      .from('recording_views')
      .insert({
        recording_id,
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

    // Increment the view count on the recording
    const { error: rpcError } = await supabase.rpc('increment_view_count', {
      p_recording_id: recording_id,
    });

    if (rpcError) {
      console.error('Failed to increment view count:', rpcError);
      // Don't fail the request — the view was still logged
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
