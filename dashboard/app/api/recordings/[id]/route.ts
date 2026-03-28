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

    // Fetch the recording (RLS ensures user can only see own)
    const { data: recording, error } = await supabase
      .from('recordings')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    // Create a signed URL for the storage file (60s expiry)
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(recording.storage_path, 60);

    if (signedUrlError) {
      return NextResponse.json(
        { error: 'Failed to generate signed URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      recording,
      signed_url: signedUrlData.signedUrl,
    });
  } catch (error) {
    console.error('Get recording error:', error);
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

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data: recording, error } = await supabase
      .from('recordings')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error || !recording) {
      return NextResponse.json(
        { error: 'Recording not found or update failed' },
        { status: 404 }
      );
    }

    return NextResponse.json(recording);
  } catch (error) {
    console.error('Update recording error:', error);
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

    // First get the recording to find its storage path
    const { data: recording, error: fetchError } = await supabase
      .from('recordings')
      .select('storage_path')
      .eq('id', params.id)
      .single();

    if (fetchError || !recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    // Remove from storage
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([recording.storage_path]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
      // Continue with DB delete even if storage delete fails
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('recordings')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete recording' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete recording error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
