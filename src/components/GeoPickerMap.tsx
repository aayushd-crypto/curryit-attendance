import { useEffect, useRef, useState } from 'react'
import { Search, X, Loader } from 'lucide-react'

interface Props {
  lat: number
  lng: number
  radiusM: number
  onChange: (lat: number, lng: number, radiusM: number) => void
}

interface SearchResult {
  display_name: string
  lat: string
  lon: string
}

export function GeoPickerMap({ lat, lng, radiusM, onChange }: Props) {
  const mapRef    = useRef<HTMLDivElement>(null)
  const mapObj    = useRef<any>(null)
  const marker    = useRef<any>(null)
  const circle    = useRef<any>(null)
  const state     = useRef({ lat, lng, radiusM })
  const inputRef  = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showDrop,  setShowDrop]  = useState(false)
  // fixed position of dropdown
  const [dropPos,  setDropPos]  = useState({ top: 0, left: 0, width: 0 })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { state.current = { lat, lng, radiusM } }, [lat, lng, radiusM])

  // close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // recalculate dropdown position when shown
  const openDrop = () => {
    if (!searchRef.current) return
    const r = searchRef.current.getBoundingClientRect()
    setDropPos({ top: r.bottom + 6, left: r.left, width: r.width })
    setShowDrop(true)
  }

  // Nominatim search debounced
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (!q) { setResults([]); setShowDrop(false); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6&accept-language=en`
        const res  = await fetch(url, { headers: { 'User-Agent': 'CURRYiT-Attendance/1.0' } })
        const data: SearchResult[] = await res.json()
        setResults(data)
        if (data.length > 0) openDrop()
        else setShowDrop(false)
      } catch {
        setShowDrop(false)
      }
      setSearching(false)
    }, 500)
  }, [query])

  const goToResult = (r: SearchResult) => {
    const newLat = parseFloat(r.lat)
    const newLng = parseFloat(r.lon)
    marker.current?.setLatLng([newLat, newLng])
    circle.current?.setLatLng([newLat, newLng])
    mapObj.current?.setView([newLat, newLng], 17)
    onChange(newLat, newLng, state.current.radiusM)
    setQuery(r.display_name.split(',').slice(0, 2).join(', '))
    setShowDrop(false)
  }

  // Init map
  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'; link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
    const loadLeaflet = () => new Promise<void>(resolve => {
      if ((window as any).L) { resolve(); return }
      const s = document.createElement('script')
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      s.onload = () => resolve()
      document.head.appendChild(s)
    })

    loadLeaflet().then(() => {
      if (!mapRef.current || mapObj.current) return
      const L = (window as any).L
      const initLat = lat || 28.5, initLng = lng || 77.2
      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false })
        .setView([initLat, initLng], 16)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
      mapObj.current = map

      const pinIcon = L.divIcon({
        className: '',
        html: `<div style="width:20px;height:20px;border-radius:50%;background:#E8531D;border:3px solid white;box-shadow:0 2px 8px rgba(232,83,29,0.5)"></div>`,
        iconSize: [20, 20], iconAnchor: [10, 10],
      })
      marker.current = L.marker([initLat, initLng], { icon: pinIcon, draggable: true })
        .addTo(map).bindPopup('📍 Drag or click map to place pin').openPopup()

      circle.current = L.circle([initLat, initLng], {
        radius: radiusM, color: '#E8531D', fillColor: '#E8531D', fillOpacity: 0.08,
      }).addTo(map)

      map.on('click', (e: any) => {
        const { lat: lt, lng: lg } = e.latlng
        marker.current?.setLatLng([lt, lg])
        circle.current?.setLatLng([lt, lg])
        onChange(lt, lg, state.current.radiusM)
      })
      marker.current.on('dragend', (e: any) => {
        const { lat: lt, lng: lg } = e.target.getLatLng()
        circle.current?.setLatLng([lt, lg])
        onChange(lt, lg, state.current.radiusM)
      })
    })

    return () => { mapObj.current?.remove(); mapObj.current = null }
  }, [])

  useEffect(() => { circle.current?.setRadius(radiusM) }, [radiusM])
  useEffect(() => {
    if (!mapObj.current || !marker.current) return
    marker.current.setLatLng([lat, lng])
    circle.current?.setLatLng([lat, lng])
    mapObj.current.setView([lat, lng], mapObj.current.getZoom())
  }, [lat, lng])

  return (
    <div className="space-y-2">
      {/* Search bar */}
      <div ref={searchRef} className="relative">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-white focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-orange-100 transition-all"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {searching
            ? <Loader size={14} className="text-gray-400 animate-spin flex-shrink-0" />
            : <Search size={14} className="text-gray-400 flex-shrink-0" />}
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && openDrop()}
            placeholder="Search address or place…"
            className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder-gray-400"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); setShowDrop(false) }}
              className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown — rendered via fixed portal to escape overflow:hidden parents */}
      {showDrop && results.length > 0 && (
        <div
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 99999 }}
          className="bg-white rounded-xl border border-gray-100 shadow-2xl overflow-hidden">
          {results.map((r, i) => (
            <button key={i} onMouseDown={() => goToResult(r)}
              className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-orange-50 active:bg-orange-100 transition-colors text-left border-b border-gray-50 last:border-0">
              <Search size={12} className="text-gray-300 mt-0.5 flex-shrink-0" />
              <span className="text-xs text-gray-700 leading-snug">{r.display_name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Map */}
      <div ref={mapRef} style={{ width: '100%', height: '260px', borderRadius: '12px', overflow: 'hidden' }} />
    </div>
  )
}
