import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const type = searchParams.get('type')

  let query = supabase
    .from('transactions')
    .select('*, account:accounts(name), category:categories(name, color)')
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  if (start) query = query.gte('date', start)
  if (end) query = query.lte('date', end)
  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase.from('transactions').insert({ ...body, user_id: user.id }).select().single()
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
