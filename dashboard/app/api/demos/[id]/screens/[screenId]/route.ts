import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { STORAGE_BUCKET } from '@/lib/constants';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; screenId: string } }
) {
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

    // Fetch screen (RLS ensures user owns the parent demo)
    const { data: screen, error: fetchError } = await supabase
      .from('screens')
      .select('storage_path, thumbnail_path')
      .eq('id', params.screenId)
      .eq('demo_id', params.id)
      .single();

    if (fetchError || !screen) {
      return NextResponse.json(
        { error: 'Screen not found' },
        { status: 404 }
      );
    }

    // Remove files from storage
    const paths = [screen.storage_path, screen.thumbnail_path].filter(
      Boolean
    ) as string[];

    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove(paths);

      if (storageError) {
        console.error('Storage delete error:', storageError);
      }
    }

    // Delete screen (cascades navigation_rules referencing this screen)
    const { error: deleteError } = await supabase
      .from('screens')
      .delete()
      .eq('id', params.screenId);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete screen' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete screen error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; screenId: string } }
) {
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
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order;
    if (body.is_start_screen !== undefined) {
      updates.is_start_screen = body.is_start_screen;

      // If setting as start screen, unset others
      if (body.is_start_screen) {
        await supabase
          .from('screens')
          .update({ is_start_screen: false })
          .eq('demo_id', params.id)
          .eq('is_start_screen', true);
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data: screen, error } = await supabase
      .from('screens')
      .update(updates)
      .eq('id', params.screenId)
      .eq('demo_id', params.id)
      .select()
      .single();

    if (error || !screen) {
      return NextResponse.json(
        { error: 'Screen not found or update failed' },
        { status: 404 }
      );
    }

    return NextResponse.json(screen);
  } catch (error) {
    console.error('Update screen error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
