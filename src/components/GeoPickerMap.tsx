import { useEffect, useRef, useState } from 'react'
import { Search, X, Loader, LocateFixed } from 'lucide-react'

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
  const mapRef     = useRef<HTMLDivElement>(null)
  const mapObj     = useRef<any>(null)
  const pinMarker  = useRef<any>(null)   // orange — saved location
  const myMarker   = useRef<any>(null)   // blue pulsing — current GPS
  const circle     = useRef<any>(null)
  const watchId    = useRef<number | null>(null)
  const state      = useRef({ lat, lng, radiusM })
  const searchRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showDrop,  setShowDrop]  = useState(false)
  const [dropPos,   setDropPos]   = useState({ top: 0, left: 0, width: 0 })
  const [locating,  setLocating]  = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { state.current = { lat, lng, radiusM } }, [lat, lng, radiusM])

  // close dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const openDrop = () => {
    if (!searchRef.current) return
    const r = searchRef.current.getBoundingClientRect()
    setDropPos({ top: r.bottom + 6, left: r.left, width: r.width })
    setShowDrop(true)
  }

  // Nominatim search
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
        if (data.length > 0) openDrop(); else setShowDrop(false)
      } catch { setShowDrop(false) }
      setSearching(false)
    }, 500)
  }, [query])

  const goToResult = (r: SearchResult) => {
    const newLat = parseFloat(r.lat), newLng = parseFloat(r.lon)
    pinMarker.current?.setLatLng([newLat, newLng])
    circle.current?.setLatLng([newLat, newLng])
    mapObj.current?.setView([newLat, newLng], 17)
    onChange(newLat, newLng, state.current.radiusM)
    setQuery(r.display_name.split(',').slice(0, 2).join(', '))
    setShowDrop(false)
  }

  // Jump to & set pin at current GPS position
  const goToMyLocation = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords
      pinMarker.current?.setLatLng([latitude, longitude])
      circle.current?.setLatLng([latitude, longitude])
      mapObj.current?.setView([latitude, longitude], 17)
      onChange(latitude, longitude, state.current.radiusM)
      setLocating(false)
    }, () => setLocating(false), { timeout: 8000, enableHighAccuracy: true })
  }

  // Init map
  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'; link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
    if (!document.getElementById('geo-pulse-style')) {
      const style = document.createElement('style')
      style.id = 'geo-pulse-style'
      style.textContent = `
        @keyframes geo-pulse { 0%,100% { box-shadow:0 0 0 4px rgba(59,130,246,0.3) } 50% { box-shadow:0 0 0 10px rgba(59,130,246,0.08) } }
        .my-location-dot { width:14px;height:14px;border-radius:50%;background:#3b82f6;border:2.5px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.3);animation:geo-pulse 2s infinite }
      `
      document.head.appendChild(style)
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

      // Orange pin — saved/target location
      const pinIcon = L.divIcon({
        className: '',
        html: `<div style="width:20px;height:20px;border-radius:50%;background:#E8531D;border:3px solid white;box-shadow:0 2px 8px rgba(232,83,29,0.5)"></div>`,
        iconSize: [20, 20], iconAnchor: [10, 10],
      })
      pinMarker.current = L.marker([initLat, initLng], { icon: pinIcon, draggable: true })
        .addTo(map).bindPopup('📍 Drag or click map to set location').openPopup()

      circle.current = L.circle([initLat, initLng], {
        radius: state.current.radiusM, color: '#E8531D', fillColor: '#E8531D', fillOpacity: 0.08,
      }).addTo(map)

      // Blue pulsing dot — live GPS position
      const myIcon = L.divIcon({ className: '', html: '<div class="my-location-dot"></div>', iconSize: [14, 14], iconAnchor: [7, 7] })
      if (navigator.geolocation) {
        watchId.current = navigator.geolocation.watchPosition(pos => {
          const { latitude, longitude } = pos.coords
          if (!myMarker.current) {
            myMarker.current = L.marker([latitude, longitude], { icon: myIcon })
              .addTo(map).bindPopup('📍 Your current location')
          } else {
            myMarker.current.setLatLng([latitude, longitude])
          }
        }, () => {}, { enableHighAccuracy: true, maximumAge: 4000 })
      }

      // Click map → move pin
      map.on('click', (e: any) => {
        const { lat: lt, lng: lg } = e.latlng
        pinMarker.current?.setLatLng([lt, lg])
        circle.current?.setLatLng([lt, lg])
        onChange(lt, lg, state.current.radiusM)
      })
      pinMarker.current.on('dragend', (e: any) => {
        const { lat: lt, lng: lg } = e.target.getLatLng()
        circle.current?.setLatLng([lt, lg])
        onChange(lt, lg, state.current.radiusM)
      })
    })

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
      mapObj.current?.remove(); mapObj.current = null
    }
  }, [])

  useEffect(() => { circle.current?.setRadius(radiusM) }, [radiusM])
  useEffect(() => {
    if (!mapObj.current || !pinMarker.current) return
    pinMarker.current.setLatLng([lat, lng])
    circle.current?.setLatLng([lat, lng])
    mapObj.current.setView([lat, lng], mapObj.current.getZoom())
  }, [lat, lng])

  return (
    <div className="space-y-2">
      {/* Search + locate row */}
      <div className="flex gap-2">
        <div ref={searchRef} className="relative flex-1">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-white focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100 transition-all"
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

        {/* Current location button */}
        <button onClick={goToMyLocation} disabled={locating}
          title="Use my current location"
          className="flex items-center justify-center w-11 rounded-xl border border-gray-200 bg-white hover:bg-orange-50 hover:border-orange-300 transition-all flex-shrink-0"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {locating
            ? <Loader size={15} className="text-orange-500 animate-spin" />
            : <LocateFixed size={15} className="text-gray-500" />}
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px] text-gray-400 px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-brand-500 flex-shrink-0" />
          Set location (drag or click)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
          Your current location
        </span>
      </div>

      {/* Dropdown — fixed to escape overflow:hidden */}
      {showDrop && results.length > 0 && (
        <div style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 99999 }}
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
