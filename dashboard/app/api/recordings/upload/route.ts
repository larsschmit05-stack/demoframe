import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  FREE_RECORDING_LIMIT,
  MAX_UPLOAD_SIZE_BYTES,
  STORAGE_BUCKET,
} from '@/lib/constants';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    // 1. Get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }
    const token = authHeader.replace('Bearer ', '');

    // 2. Create service client and validate user
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

    // 3. Query user's subscription_tier
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // 4. If free tier, check recording limit
    if (userData.subscription_tier === 'free') {
      const { data: countData, error: countError } = await supabase.rpc(
        'get_active_recording_count',
        { p_user_id: user.id }
      );

      if (countError) {
        return NextResponse.json(
          { error: 'Failed to check recording count' },
          { status: 500 }
        );
      }

      if (countData >= FREE_RECORDING_LIMIT) {
        return NextResponse.json(
          {
            error: `Free plan is limited to ${FREE_RECORDING_LIMIT} active recordings. Please upgrade to Pro.`,
            upgrade_url: '/dashboard/billing',
          },
          { status: 402 }
        );
      }
    }

    // 5. Parse request body
    const body = await request.json();
    const { name, app_url, recording_data, metadata } = body;

    if (!name || !recording_data) {
      return NextResponse.json(
        { error: 'Missing required fields: name, recording_data' },
        { status: 400 }
      );
    }

    // 6. Check recording data size
    const dataSize = JSON.stringify(recording_data).length;
    if (dataSize > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `Recording data exceeds maximum size of ${MAX_UPLOAD_SIZE_BYTES} bytes`,
        },
        { status: 413 }
      );
    }

    // 7. Generate recording ID
    const recordingId = crypto.randomUUID();

    // 8. Upload to storage
    const storagePath = `users/${user.id}/recordings/${recordingId}.json`;
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, JSON.stringify(recording_data), {
        contentType: 'application/json',
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: 'Failed to upload recording data' },
        { status: 500 }
      );
    }

    // 9. Insert into recordings table
    const { data: recording, error: insertError } = await supabase
      .from('recordings')
      .insert({
        id: recordingId,
        user_id: user.id,
        name,
        app_url: app_url || null,
        storage_path: storagePath,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (insertError) {
      // Clean up uploaded file if DB insert fails
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      return NextResponse.json(
        { error: 'Failed to create recording record' },
        { status: 500 }
      );
    }

    // 10. Return success
    return NextResponse.json(recording, { status: 201 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
