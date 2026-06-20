/**
 * send-leave-email Edge Function
 *
 * Called when an admin approves or rejects a leave request.
 * Sends an email to the employee via Resend.
 *
 * Deploy:
 *   supabase functions deploy send-leave-email
 *
 * Required secrets (set in Supabase Dashboard → Edge Functions → Secrets):
 *   RESEND_API_KEY   — from resend.com
 *   FROM_EMAIL       — e.g. "CURRYiT Attendance <attendance@yourdomain.com>"
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { leave_request_id, status, remarks } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch leave request + employee details
    const { data: leave, error: leaveErr } = await supabase
      .from('leave_requests')
      .select(`
        id, leave_type, start_date, end_date, total_days, reason, status,
        employees ( name, email )
      `)
      .eq('id', leave_request_id)
      .single()

    if (leaveErr || !leave) {
      return new Response(JSON.stringify({ error: 'Leave request not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const emp = (leave as any).employees
    if (!emp?.email) {
      return new Response(JSON.stringify({ error: 'Employee email not found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const isApproved = status === 'approved'
    const leaveTypeLabel = (leave as any).leave_type === 'special' ? 'Special Leave' : 'Casual Leave'
    const fromDate = new Date((leave as any).start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    const toDate   = new Date((leave as any).end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    const days     = (leave as any).total_days

    const subject = isApproved
      ? `✅ Leave Approved — ${fromDate} to ${toDate}`
      : `❌ Leave Rejected — ${fromDate} to ${toDate}`

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f2f7; margin: 0; padding: 24px;">
  <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%); padding: 28px 32px; text-align: center;">
      <p style="color: rgba(255,255,255,0.5); font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 6px;">CURRYiT Attendance</p>
      <h1 style="color: white; font-size: 22px; font-weight: 900; margin: 0;">Leave ${isApproved ? 'Approved ✅' : 'Rejected ❌'}</h1>
    </div>

    <!-- Body -->
    <div style="padding: 28px 32px;">
      <p style="color: #374151; font-size: 15px; margin: 0 0 20px;">Hi <strong>${emp.name}</strong>,</p>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">
        Your leave request has been <strong style="color: ${isApproved ? '#16a34a' : '#dc2626'};">${status}</strong>.
      </p>

      <!-- Details card -->
      <div style="background: #f9fafb; border-radius: 14px; padding: 20px; margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 6px 0;">Type</td>
            <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${leaveTypeLabel}</td>
          </tr>
          <tr>
            <td style="color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 6px 0;">From</td>
            <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${fromDate}</td>
          </tr>
          <tr>
            <td style="color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 6px 0;">To</td>
            <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${toDate}</td>
          </tr>
          <tr>
            <td style="color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 6px 0;">Days</td>
            <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${days} day${days !== 1 ? 's' : ''}</td>
          </tr>
          ${remarks ? `
          <tr>
            <td style="color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 6px 0;">Remarks</td>
            <td style="color: #374151; font-size: 13px; text-align: right;">${remarks}</td>
          </tr>` : ''}
        </table>
      </div>

      ${!isApproved ? `<p style="color: #6b7280; font-size: 13px;">If you have questions, please speak with your admin.</p>` : `<p style="color: #6b7280; font-size: 13px;">Enjoy your time off! 🎉</p>`}
    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; padding: 16px 32px; text-align: center; border-top: 1px solid #f0f0f0;">
      <p style="color: #d1d5db; font-size: 11px; margin: 0;">CURRYiT Attendance Management · This is an automated email</p>
    </div>
  </div>
</body>
</html>`

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const FROM_EMAIL     = Deno.env.get('FROM_EMAIL') ?? 'CURRYiT Attendance <onboarding@resend.dev>'

    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not set — email not sent')
      return new Response(JSON.stringify({ warning: 'RESEND_API_KEY not configured' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [emp.email], subject, html }),
    })

    const resBody = await res.json()
    if (!res.ok) throw new Error(resBody.message ?? 'Resend error')

    return new Response(JSON.stringify({ ok: true, email_id: resBody.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('send-leave-email error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
