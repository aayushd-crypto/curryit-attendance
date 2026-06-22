import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const authHeader = req.headers.get('Authorization')
    const { data: { user }, error: authErr } = await adminClient.auth.getUser(
      authHeader?.replace('Bearer ', '') ?? ''
    )
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const { data: callerProfile } = await adminClient
      .from('profiles').select('role').eq('id', user.id).single()
    if (!['admin', 'super_admin'].includes(callerProfile?.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
    }

    const body = await req.json()

    if (body.action === 'reset_password') {
      if (callerProfile?.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: 'Only super_admin can reset passwords' }), { status: 403, headers: corsHeaders })
      }
      const { email: targetEmail, new_password } = body
      if (!targetEmail || !new_password) {
        return new Response(JSON.stringify({ error: 'email and new_password required' }), { status: 400, headers: corsHeaders })
      }

      // Look up auth user ID from profiles table using email
      const { data: profile, error: profileErr } = await adminClient
        .from('profiles').select('id').eq('email', targetEmail).single()

      if (profileErr || !profile) {
        return new Response(JSON.stringify({ error: 'User not found in profiles' }), { status: 404, headers: corsHeaders })
      }

      const { error: updateErr } = await adminClient.auth.admin.updateUserById(profile.id, { password: new_password })
      if (updateErr) throw updateErr

      return new Response(JSON.stringify({ updated: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { name, email, mobile, department_id, designation, location, joining_date, role = 'employee', temp_password } = body

    if (!name || !email || !temp_password) {
      return new Response(JSON.stringify({ error: 'name, email and temp_password are required' }), { status: 400, headers: corsHeaders })
    }

    const { count } = await adminClient.from('employees').select('*', { count: 'exact', head: true })
    const emp_code = `EMP${String((count ?? 0) + 1).padStart(3, '0')}`

    const { data: emp, error: empErr } = await adminClient.from('employees').insert({
      employee_code: emp_code, name, mobile: mobile ?? '', email,
      department_id: department_id ?? null, designation: designation ?? 'Employee',
      location: location ?? 'office', joining_date: joining_date ?? new Date().toISOString().split('T')[0],
      status: 'active',
    }).select().single()

    if (empErr) {
      if (empErr.code === '23505') return new Response(JSON.stringify({ error: 'An employee with this email already exists.' }), { status: 409, headers: corsHeaders })
      throw empErr
    }

    const { data: authUser, error: authCreateErr } = await adminClient.auth.admin.createUser({
      email, password: temp_password,
      email_confirm: true,
      user_metadata: { full_name: name, role },
    })
    if (authCreateErr) {
      await adminClient.from('employees').delete().eq('id', emp.id)
      throw authCreateErr
    }

    await adminClient.from('profiles').upsert({
      id: authUser.user.id, email, full_name: name,
      role, employee_id: emp.id,
    }, { onConflict: 'id' })

    await adminClient.from('leave_balances').insert({
      employee_id: emp.id, year: new Date().getFullYear(),
      casual_total: 12, sick_total: 12, emergency_total: 6, paid_total: 15,
    }).throwOnError()

    return new Response(JSON.stringify({
      success: true,
      employee_code: emp_code,
      message: `Employee created. They can log in with ${email} and password: ${temp_password}`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? 'Unexpected error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
