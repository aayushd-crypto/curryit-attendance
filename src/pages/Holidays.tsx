import { useEffect, useState } from 'react'
import { format, parseISO, isFuture, isToday, startOfYear, endOfYear, getYear } from 'date-fns'
import { CalendarDays, Plus, Trash2, Upload, X, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import { Spinner } from '../Spinner'

interface Holiday {
  id: string
  holiday_date: string
  name: string
  location: string
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const locationLabel = (l: string) => l === 'all' ? 'All' : l === 'office' ? 'Office' : 'CMK'
const locationColor  = (l: string) =>
  l === 'all'    ? 'bg-purple-100 text-purple-700' :
  l === 'office' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'

export default function Holidays() {
  const { role } = useAuth()
  const isAdmin = role === 'admin' || role === 'super_admin'

  const [year, setYear]           = useState(new Date().getFullYear())
  const [holidays, setHolidays]   = useState<Holiday[]>([])
  const [loading, setLoading]     = useState(true)

  // Add single
  const [addModal, setAddModal]   = useState(false)
  const [newDate, setNewDate]     = useState('')
  const [newName, setNewName]     = useState('')
  const [newLoc, setNewLoc]       = useState<'all'|'office'|'cmk'>('all')
  const [saving, setSaving]       = useState(false)
  const [saveErr, setSaveErr]     = useState<string|null>(null)

  // Bulk CSV
  const [csvModal, setCsvModal]   = useState(false)
  const [csvText, setCsvText]     = useState('')
  const [csvRows, setCsvRows]     = useState<{date:string;name:string;location:string;err?:string}[]>([])
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(false)

  // Delete
  const [delIds, setDelIds]       = useState<Set<string>>(new Set())
  const [delBusy, setDelBusy]     = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('holidays')
      .select('id, holiday_date, name, location')
      .gte('holiday_date', `${year}-01-01`)
      .lte('holiday_date', `${year}-12-31`)
      .order('holiday_date')
    setHolidays((data ?? []) as Holiday[])
    setLoading(false)
  }

  useEffect(() => { load() }, [year])

  // Group by month
  const byMonth: Record<number, Holiday[]> = {}
  holidays.forEach(h => {
    const m = parseISO(h.holiday_date).getMonth()
    if (!byMonth[m]) byMonth[m] = []
    byMonth[m].push(h)
  })

  const upcoming = holidays.filter(h => isFuture(parseISO(h.holiday_date)) || isToday(parseISO(h.holiday_date)))

  // ── Add single ────────────────────────────────────────────────────────────
  const saveHoliday = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveErr(null); setSaving(true)
    const { error } = await (supabase.from('holidays') as any).insert({ holiday_date: newDate, name: newName.trim(), location: newLoc })
    if (error) { setSaveErr(error.message); setSaving(false); return }
    setAddModal(false); setNewDate(''); setNewName(''); setNewLoc('all')
    await load()
    setSaving(false)
  }

  // ── CSV parse ─────────────────────────────────────────────────────────────
  const parseCSV = (raw: string) => {
    const lines = raw.trim().split('\n').filter(l => l.trim())
    return lines.map(line => {
      const [date, name, location = 'all'] = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date)
      const locOk  = ['all','office','cmk'].includes(location)
      let err: string|undefined
      if (!dateOk) err = 'Invalid date (use YYYY-MM-DD)'
      else if (!name) err = 'Name required'
      else if (!locOk) err = 'Location must be all/office/cmk'
      return { date, name, location, err }
    })
  }

  const onCsvChange = (val: string) => { setCsvText(val); setCsvRows(parseCSV(val)) }

  const importCSV = async () => {
    const valid = csvRows.filter(r => !r.err)
    if (!valid.length) return
    setImporting(true)
    const rows = valid.map(r => ({ holiday_date: r.date, name: r.name, location: r.location }))
    await (supabase.from('holidays') as any).insert(rows)
    setImportDone(true); setImporting(false)
    await load()
    setTimeout(() => { setCsvModal(false); setCsvText(''); setCsvRows([]); setImportDone(false) }, 1500)
  }

  const downloadTemplate = () => {
    const csv = 'date,name,location\n2026-01-26,Republic Day,all\n2026-08-15,Independence Day,all\n'
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'holidays_template.csv'; a.click()
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const toggleDel = (id: string) => setDelIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const deleteSelected = async () => {
    if (!delIds.size) return
    setDelBusy(true)
    await supabase.from('holidays').delete().in('id', [...delIds])
    setDelIds(new Set()); await load(); setDelBusy(false)
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Holidays</h1>
          <p className="page-subtitle">{holidays.length} holiday{holidays.length !== 1 ? 's' : ''} in {year}</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            {delIds.size > 0 && (
              <button onClick={deleteSelected} disabled={delBusy}
                className="btn-secondary text-red-600 border-red-200 hover:bg-red-50">
                {delBusy ? <Spinner size="sm" /> : <Trash2 size={15} />}
                Delete ({delIds.size})
              </button>
            )}
            <button onClick={() => { setCsvModal(true); setImportDone(false) }} className="btn-secondary">
              <Upload size={15} /> Bulk Import
            </button>
            <button onClick={() => { setAddModal(true); setSaveErr(null) }} className="btn-primary">
              <Plus size={15} /> Add Holiday
            </button>
          </div>
        )}
      </div>

      {/* Year selector */}
      <div className="flex items-center gap-3">
        <button onClick={() => setYear(y => y - 1)} className="p-2 rounded-xl bg-white shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-xl font-black text-gray-900 min-w-[60px] text-center">{year}</span>
        <button onClick={() => setYear(y => y + 1)} className="p-2 rounded-xl bg-white shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : (
        <>
          {/* Upcoming strip — only current year */}
          {year === new Date().getFullYear() && upcoming.length > 0 && (
            <div className="card p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Upcoming holidays</p>
              <div className="flex flex-wrap gap-2">
                {upcoming.map(h => (
                  <span key={h.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg,#1a1a2e,#0f3460)' }}>
                    🎉 {h.name} · {format(parseISO(h.holiday_date), 'dd MMM')}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${locationColor(h.location)}`}>
                      {locationLabel(h.location)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Month-wise grid */}
          {Object.keys(byMonth).length === 0 ? (
            <div className="card p-16 text-center">
              <CalendarDays size={40} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-400 font-medium">No holidays for {year}</p>
              {isAdmin && <p className="text-sm text-gray-400 mt-1">Click "Add Holiday" or "Bulk Import" to get started</p>}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(byMonth).map(([mStr, hols]) => {
                const m = Number(mStr)
                return (
                  <div key={m} className="card p-4">
                    <h3 className="font-black text-gray-700 text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-black"
                        style={{ background: 'linear-gradient(135deg,#E8531D,#C44010)' }}>{MONTHS[m][0]}</span>
                      {MONTHS[m]}
                    </h3>
                    <div className="space-y-2">
                      {hols.map(h => {
                        const past = !isFuture(parseISO(h.holiday_date)) && !isToday(parseISO(h.holiday_date))
                        const selected = delIds.has(h.id)
                        return (
                          <div key={h.id}
                            className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                              selected ? 'bg-red-50 border border-red-200' : 'bg-gray-50 hover:bg-gray-100'
                            }`}>
                            {isAdmin && (
                              <input type="checkbox" checked={selected} onChange={() => toggleDel(h.id)}
                                className="w-4 h-4 accent-red-500 rounded flex-shrink-0 cursor-pointer" />
                            )}
                            <div className="w-10 flex-shrink-0 text-center">
                              <p className="text-lg font-black text-gray-800 leading-none">
                                {format(parseISO(h.holiday_date), 'dd')}
                              </p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase">
                                {format(parseISO(h.holiday_date), 'EEE')}
                              </p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold truncate ${past ? 'text-gray-400' : 'text-gray-800'}`}>{h.name}</p>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${locationColor(h.location)}`}>
                                {locationLabel(h.location)}
                              </span>
                            </div>
                            {isAdmin && (
                              <button onClick={async () => {
                                await supabase.from('holidays').delete().eq('id', h.id); await load()
                              }} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Add Holiday Modal ─────────────────────────────────────────────── */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Add Holiday</h2>
              <button onClick={() => setAddModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <form onSubmit={saveHoliday} className="p-6 space-y-4">
              <div>
                <label className="label">Date</label>
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="input" required />
              </div>
              <div>
                <label className="label">Holiday name</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="input" required placeholder="e.g. Diwali" />
              </div>
              <div>
                <label className="label">Applies to</label>
                <select value={newLoc} onChange={e => setNewLoc(e.target.value as any)} className="input">
                  <option value="all">All employees</option>
                  <option value="office">Office only</option>
                  <option value="cmk">CMK only</option>
                </select>
              </div>
              {saveErr && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{saveErr}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setAddModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <Spinner size="sm" /> : <Plus size={15} />}
                  {saving ? 'Saving...' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Bulk CSV Modal ────────────────────────────────────────────────── */}
      {csvModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 px-4 pb-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900">Bulk Import Holidays</h2>
                <p className="text-xs text-gray-400 mt-0.5">Paste CSV: <code className="bg-gray-100 px-1 rounded">date,name,location</code></p>
              </div>
              <button onClick={() => setCsvModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {importDone ? (
                <div className="text-center py-10">
                  <p className="text-4xl mb-3">✅</p>
                  <p className="font-bold text-gray-800">Imported successfully!</p>
                </div>
              ) : (
                <>
                  <button onClick={downloadTemplate} className="btn-secondary w-full justify-center">
                    <Download size={14} /> Download template CSV
                  </button>
                  <div>
                    <label className="label">Paste CSV rows</label>
                    <textarea
                      value={csvText}
                      onChange={e => onCsvChange(e.target.value)}
                      rows={8}
                      className="input font-mono text-xs resize-none"
                      placeholder={`2026-01-26,Republic Day,all\n2026-03-25,Holi,all\n2026-10-02,Gandhi Jayanti,office`}
                    />
                  </div>
                  {csvRows.length > 0 && (
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-[400px]">
                          <thead><tr><th className="text-left px-3 py-2 bg-gray-50 text-gray-500">Date</th><th className="text-left px-3 py-2 bg-gray-50 text-gray-500">Name</th><th className="text-left px-3 py-2 bg-gray-50 text-gray-500">Location</th><th className="px-3 py-2 bg-gray-50"></th></tr></thead>
                          <tbody>
                            {csvRows.map((r, i) => (
                              <tr key={i} className={r.err ? 'bg-red-50' : 'bg-white'}>
                                <td className="px-3 py-2 font-mono">{r.date}</td>
                                <td className="px-3 py-2">{r.name}</td>
                                <td className="px-3 py-2">{r.location}</td>
                                <td className="px-3 py-2 text-right">
                                  {r.err
                                    ? <span className="text-red-500">{r.err}</span>
                                    : <span className="text-green-500 font-bold">✓</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-3 py-2 bg-gray-50 text-xs text-gray-500 border-t border-gray-100">
                        {csvRows.filter(r => !r.err).length} valid · {csvRows.filter(r => r.err).length} errors
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            {!importDone && (
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                <button onClick={() => setCsvModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button onClick={importCSV} disabled={importing || !csvRows.filter(r => !r.err).length} className="btn-primary flex-1 justify-center">
                  {importing ? <Spinner size="sm" /> : <Upload size={14} />}
                  {importing ? 'Importing...' : `Import ${csvRows.filter(r => !r.err).length} holidays`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
