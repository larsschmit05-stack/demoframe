import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  MAX_SCREEN_SIZE_BYTES,
  MAX_SCREENS_PER_DEMO,
  STORAGE_BUCKET,
} from '@/lib/constants';
import crypto from 'crypto';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authenticate via Bearer token (used by Chrome extension)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }
    const token = authHeader.replace('Bearer ', '');

    const supabase = createServiceClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // 2. Verify demo exists and belongs to user
    const { data: demo, error: demoError } = await supabase
      .from('demos')
      .select('id, user_id')
      .eq('id', params.id)
      .single();

    if (demoError || !demo) {
      return NextResponse.json(
        { error: 'Demo not found' },
        { status: 404 }
      );
    }

    if (demo.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // 3. Check screen count limit
    const { data: screenCount } = await supabase.rpc('get_screen_count', {
      p_demo_id: params.id,
    });

    if (screenCount >= MAX_SCREENS_PER_DEMO) {
      return NextResponse.json(
        { error: `Maximum ${MAX_SCREENS_PER_DEMO} screens per demo` },
        { status: 400 }
      );
    }

    // 4. Parse request body
    const body = await request.json();
    const {
      name,
      source_url,
      html_content,
      viewport_width,
      viewport_height,
      interactive_elements,
      is_start_screen,
    } = body;

    if (!name || !source_url || !html_content) {
      return NextResponse.json(
        { error: 'Missing required fields: name, source_url, html_content' },
        { status: 400 }
      );
    }

    // 5. Check size
    const sizeBytes = new TextEncoder().encode(html_content).length;
    if (sizeBytes > MAX_SCREEN_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `Screen snapshot exceeds maximum size of ${Math.round(MAX_SCREEN_SIZE_BYTES / 1024 / 1024)}MB`,
        },
        { status: 413 }
      );
    }

    // 6. Upload HTML to storage
    const screenId = crypto.randomUUID();
    const storagePath = `users/${user.id}/demos/${params.id}/screens/${screenId}.html`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, html_content, {
        contentType: 'text/html',
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: 'Failed to upload screen snapshot' },
        { status: 500 }
      );
    }

    // 7. Determine sort order
    const { data: existingScreens } = await supabase
      .from('screens')
      .select('sort_order')
      .eq('demo_id', params.id)
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextSortOrder =
      existingScreens && existingScreens.length > 0
        ? existingScreens[0].sort_order + 1
        : 0;

    // 8. If this is marked as start screen, unset any existing start screen
    if (is_start_screen) {
      await supabase
        .from('screens')
        .update({ is_start_screen: false })
        .eq('demo_id', params.id)
        .eq('is_start_screen', true);
    }

    // 9. Insert screen record
    const { data: screen, error: insertError } = await supabase
      .from('screens')
      .insert({
        id: screenId,
        demo_id: params.id,
        name,
        source_url,
        storage_path: storagePath,
        sort_order: nextSortOrder,
        viewport_width: viewport_width || 1280,
        viewport_height: viewport_height || 720,
        size_bytes: sizeBytes,
        is_start_screen: is_start_screen || nextSortOrder === 0,
        interactive_elements: interactive_elements || [],
      })
      .select()
      .single();

    if (insertError) {
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      return NextResponse.json(
        { error: 'Failed to create screen record' },
        { status: 500 }
      );
    }

    return NextResponse.json(screen, { status: 201 });
  } catch (error) {
    console.error('Screen upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
