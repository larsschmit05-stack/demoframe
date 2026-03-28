import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { STORAGE_BUCKET } from '@/lib/constants';

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
        { error: 'Invalid recording ID' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createServiceClient();

    const { data: recording, error } = await supabase
      .from('recordings')
      .select('id, name, app_url, metadata, is_active, storage_path')
      .eq('id', params.id)
      .single();

    if (error || !recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    if (!recording.is_active) {
      return NextResponse.json(
        { error: 'This demo is no longer available' },
        { status: 404, headers: corsHeaders }
      );
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(recording.storage_path, 300);

    if (signedUrlError || !signedUrlData) {
      return NextResponse.json(
        { error: 'Failed to generate recording URL' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        name: recording.name,
        app_url: recording.app_url,
        metadata: recording.metadata,
        signed_url: signedUrlData.signedUrl,
      },
      {
        headers: {
          ...corsHeaders,
          'Cache-Control': 'public, s-maxage=60',
        },
      }
    );
  } catch (error) {
    console.error('Embed API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
