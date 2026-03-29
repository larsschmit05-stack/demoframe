import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { STORAGE_BUCKET } from '@/lib/constants';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
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

    // Fetch demo with screens and navigation rules
    const { data: demo, error } = await supabase
      .from('demos')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !demo) {
      return NextResponse.json(
        { error: 'Demo not found' },
        { status: 404 }
      );
    }

    // Fetch screens
    const { data: screens } = await supabase
      .from('screens')
      .select('*')
      .eq('demo_id', params.id)
      .order('sort_order', { ascending: true });

    // Fetch navigation rules
    const { data: navigation_rules } = await supabase
      .from('navigation_rules')
      .select('*')
      .eq('demo_id', params.id);

    // Generate signed URLs for each screen
    const screensWithUrls = await Promise.all(
      (screens || []).map(async (screen) => {
        const { data: signedUrlData } = await supabase
          .storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(screen.storage_path, 60);

        return {
          ...screen,
          signed_url: signedUrlData?.signedUrl || null,
        };
      })
    );

    return NextResponse.json({
      demo,
      screens: screensWithUrls,
      navigation_rules: navigation_rules || [],
    });
  } catch (error) {
    console.error('Get demo error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
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
    if (body.is_active !== undefined) updates.is_active = body.is_active;
    if (body.app_url !== undefined) updates.app_url = body.app_url;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data: demo, error } = await supabase
      .from('demos')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error || !demo) {
      return NextResponse.json(
        { error: 'Demo not found or update failed' },
        { status: 404 }
      );
    }

    return NextResponse.json(demo);
  } catch (error) {
    console.error('Update demo error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
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

    // Get all screen storage paths for cleanup
    const { data: screens } = await supabase
      .from('screens')
      .select('storage_path, thumbnail_path')
      .eq('demo_id', params.id);

    // Remove screen files from storage
    if (screens && screens.length > 0) {
      const paths = screens
        .flatMap((s) => [s.storage_path, s.thumbnail_path])
        .filter(Boolean) as string[];

      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove(paths);

        if (storageError) {
          console.error('Storage delete error:', storageError);
        }
      }
    }

    // Delete demo (cascades to screens, navigation_rules, demo_views)
    const { error: deleteError } = await supabase
      .from('demos')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete demo' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete demo error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
