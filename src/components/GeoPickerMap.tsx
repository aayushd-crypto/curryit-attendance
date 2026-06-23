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
  const mapRef   = useRef<HTMLDivElement>(null)
  const mapObj   = useRef<any>(null)
  const marker   = useRef<any>(null)
  const circle   = useRef<any>(null)
  const state    = useRef({ lat, lng, radiusM })

  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showDrop, setShowDrop]   = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounce  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { state.current = { lat, lng, radiusM } }, [lat, lng, radiusM])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Nominatim search (debounced 400ms)
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    const q = query.trim()
    if (!q) { setResults([]); setShowDrop(false); return }
    debounce.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=in`,
          { headers: { 'Accept-Language': 'en' } }
        )
        const data: SearchResult[] = await res.json()
        setResults(data)
        setShowDrop(data.length > 0)
      } catch { /* silent */ }
      setSearching(false)
    }, 400)
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

  // Init Leaflet map
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
      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false })
        .setView([lat || 28.5, lng || 77.2], 16)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
      mapObj.current = map

      const pinIcon = L.divIcon({
        className: '',
        html: `<div style="width:20px;height:20px;border-radius:50%;background:#E8531D;border:3px solid white;box-shadow:0 2px 8px rgba(232,83,29,0.5)"></div>`,
        iconSize: [20, 20], iconAnchor: [10, 10],
      })
      marker.current = L.marker([lat || 28.5, lng || 77.2], { icon: pinIcon, draggable: true })
        .addTo(map).bindPopup('📍 Drag or click map to set location').openPopup()

      circle.current = L.circle([lat || 28.5, lng || 77.2], {
        radius: radiusM, color: '#E8531D', fillColor: '#E8531D', fillOpacity: 0.08,
      }).addTo(map)

      map.on('click', (e: any) => {
        const { lat: newLat, lng: newLng } = e.latlng
        marker.current?.setLatLng([newLat, newLng])
        circle.current?.setLatLng([newLat, newLng])
        onChange(newLat, newLng, state.current.radiusM)
      })

      marker.current.on('dragend', (e: any) => {
        const { lat: newLat, lng: newLng } = e.target.getLatLng()
        circle.current?.setLatLng([newLat, newLng])
        onChange(newLat, newLng, state.current.radiusM)
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
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-white focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 transition-all">
          {searching
            ? <Loader size={14} className="text-gray-400 animate-spin flex-shrink-0" />
            : <Search size={14} className="text-gray-400 flex-shrink-0" />}
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowDrop(true)}
            placeholder="Search for a place or address…"
            className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder-gray-400"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); setShowDrop(false) }}
              className="text-gray-300 hover:text-gray-500 transition-colors">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Dropdown results */}
        {showDrop && results.length > 0 && (
          <div className="absolute top-full mt-1.5 left-0 right-0 bg-white rounded-xl border border-gray-100 shadow-xl z-[9999] overflow-hidden">
            {results.map((r, i) => (
              <button key={i} onClick={() => goToResult(r)}
                className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-orange-50 transition-colors text-left border-b border-gray-50 last:border-0">
                <Search size={13} className="text-gray-300 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-gray-700 leading-snug line-clamp-2">
                  {r.display_name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div ref={mapRef} style={{ width: '100%', height: '260px', borderRadius: '12px', overflow: 'hidden' }} />
    </div>
  )
}
