/**
 * Auto-checkout Edge Function
 *
 * Schedule: Every day at 22:00 IST (16:30 UTC)
 * Action:   Find attendance records with check_in but no check_out today.
 *           Set check_out_time = 19:00:00 (7 PM IST) and calculate worked_minutes.
 *
 * Deploy with:
 *   supabase functions deploy auto-checkout
 *
 * Schedule with (run in Supabase SQL editor using pg_cron extension):
 *   select cron.schedule(
 *     'auto-checkout-daily',
 *     '30 16 * * *',   -- 16:30 UTC = 22:00 IST
 *     $$
 *       select net.http_post(
 *         url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/auto-checkout',
 *         headers := '{"Authorization": "Bearer <YOUR_SERVICE_ROLE_KEY>"}'::jsonb
 *       );
 *     $$
 *   );
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AUTO_CHECKOUT_TIME = '19:00:00'   // recorded checkout time (7 PM IST)
const CHECK_IN_HOURS     = 7            // 7 hours before checkout = 12:00 PM
const WORK_HOURS_MINUTES = 7 * 60       // 7 hours in minutes (12pm–7pm)

Deno.serve(async (req) => {
  // Allow manual HTTP trigger as well as scheduled invocations
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get today's date in IST (UTC+5:30)
    const now      = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istNow   = new Date(now.getTime() + istOffset)
    const todayIST = istNow.toISOString().slice(0, 10)

    // Find all records checked in today with no checkout yet
    const { data: openRecords, error: fetchErr } = await supabase
      .from('attendance')
      .select('id, check_in_time')
      .eq('date', todayIST)
      .not('check_in_time', 'is', null)
      .is('check_out_time', null)
      .eq('status', 'present')

    if (fetchErr) throw fetchErr

    if (!openRecords || openRecords.length === 0) {
      return new Response(JSON.stringify({ message: 'No open check-ins found.', date: todayIST }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Calculate worked_minutes for each record based on their check_in_time vs 7PM
    const checkoutH = 19, checkoutM = 0

    const updates = openRecords.map(rec => {
      const [inH, inM] = (rec.check_in_time as string).split(':').map(Number)
      const checkInMins  = inH * 60 + inM
      const checkOutMins = checkoutH * 60 + checkoutM
      const worked       = Math.max(0, checkOutMins - checkInMins)
      const overtime     = Math.max(0, worked - 540) // 9h standard

      return supabase
        .from('attendance')
        .update({
          check_out_time:   AUTO_CHECKOUT_TIME,
          worked_minutes:   worked,
          overtime_minutes: overtime,
        })
        .eq('id', rec.id)
    })

    await Promise.all(updates)

    return new Response(
      JSON.stringify({
        message: `Auto-checked out ${openRecords.length} employee(s).`,
        date:    todayIST,
        count:   openRecords.length,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
