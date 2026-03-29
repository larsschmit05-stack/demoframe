import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    const { data: rules, error } = await supabase
      .from('navigation_rules')
      .select(`
        *,
        source_screen:screens!source_screen_id(name),
        target_screen:screens!target_screen_id(name)
      `)
      .eq('demo_id', params.id);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch navigation rules' },
        { status: 500 }
      );
    }

    return NextResponse.json(rules);
  } catch (error) {
    console.error('List navigation rules error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const {
      source_screen_id,
      target_screen_id,
      trigger_selector,
      trigger_text,
    } = body;

    if (!source_screen_id || !target_screen_id || !trigger_selector) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: source_screen_id, target_screen_id, trigger_selector',
        },
        { status: 400 }
      );
    }

    // Verify both screens belong to this demo
    const { data: screens, error: screenError } = await supabase
      .from('screens')
      .select('id')
      .eq('demo_id', params.id)
      .in('id', [source_screen_id, target_screen_id]);

    if (screenError || !screens || screens.length !== 2) {
      return NextResponse.json(
        { error: 'One or both screens not found in this demo' },
        { status: 400 }
      );
    }

    const { data: rule, error: insertError } = await supabase
      .from('navigation_rules')
      .insert({
        demo_id: params.id,
        source_screen_id,
        target_screen_id,
        trigger_selector,
        trigger_text: trigger_text || null,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to create navigation rule' },
        { status: 500 }
      );
    }

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error('Create navigation rule error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('rule_id');

    if (!ruleId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: rule_id' },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from('navigation_rules')
      .delete()
      .eq('id', ruleId);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete navigation rule' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete navigation rule error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
