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

    const body = await req.json()

    // CMK coordinator can only add labor workers
    if (callerProfile?.role === 'cmk_coordinator' && body.action !== 'add_labor_worker') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
    }
    if (!['admin', 'super_admin', 'cmk_coordinator'].includes(callerProfile?.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
    }

    // ── Add CMK labor worker (cmk_coordinator or admin) ─────────────────────
    if (body.action === 'add_labor_worker') {
      const { name, mobile } = body
      if (!name) return new Response(JSON.stringify({ error: 'name required' }), { status: 400, headers: corsHeaders })
      const { count } = await adminClient.from('employees').select('*', { count: 'exact', head: true })
      const code = `CMK${String((count ?? 0) + 1).padStart(3, '0')}`
      const { data: emp, error: empErr } = await adminClient.from('employees').insert({
        employee_code: code,
        name: name.trim(),
        mobile: mobile?.trim() || '',
        email: `${code.toLowerCase()}@cmk.labor`,
        location: 'cmk',
        employee_type: 'labor',
        designation: 'CMK Worker',
        joining_date: new Date().toISOString().split('T')[0],
        status: 'active',
      }).select().single()
      if (empErr) throw empErr
      return new Response(JSON.stringify({ success: true, employee: emp }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

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

    // Send welcome email with credentials
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'noreply@curryit.in'
    if (resendKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `CURRYiT Attendance <${fromEmail}>`,
          to: [email],
          subject: `Welcome to CURRYiT Attendance Portal — Your Login Details`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
              <div style="background:linear-gradient(135deg,#E8531D,#C44010);padding:32px 24px;text-align:center;">
                <h1 style="color:white;margin:0;font-size:24px;font-weight:900;">Welcome to CURRYiT! 🎉</h1>
                <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Your attendance portal account is ready</p>
              </div>
              <div style="padding:32px 24px;">
                <p style="color:#374151;font-size:15px;">Hi <strong>${name}</strong>,</p>
                <p style="color:#6B7280;font-size:14px;">Your account has been created. Here are your login details:</p>
                <div style="background:#F9FAFB;border-radius:8px;padding:20px;margin:20px 0;border:1px solid #E5E7EB;">
                  <table style="width:100%;border-collapse:collapse;">
                    <tr><td style="color:#6B7280;font-size:13px;padding:6px 0;">Employee ID</td><td style="color:#111827;font-weight:700;font-size:14px;">${emp_code}</td></tr>
                    <tr><td style="color:#6B7280;font-size:13px;padding:6px 0;">Email</td><td style="color:#111827;font-weight:700;font-size:14px;">${email}</td></tr>
                    <tr><td style="color:#6B7280;font-size:13px;padding:6px 0;">Password</td><td style="color:#E8531D;font-weight:700;font-size:14px;font-family:monospace;">${temp_password}</td></tr>
                  </table>
                </div>
                <a href="${Deno.env.get('VITE_APP_URL') ?? 'https://curryit-attendance.vercel.app'}" style="display:block;background:linear-gradient(135deg,#E8531D,#C44010);color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Sign In Now →</a>
                <p style="color:#9CA3AF;font-size:12px;margin-top:20px;">Please change your password after first login. If you have any issues, contact your admin.</p>
              </div>
            </div>
          `
        })
      }).catch(() => {/* email failure is non-critical */})
    }

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
