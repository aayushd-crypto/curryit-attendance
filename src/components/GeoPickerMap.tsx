import { useEffect, useRef } from 'react'

interface Props {
  lat: number
  lng: number
  radiusM: number
  onChange: (lat: number, lng: number, radiusM: number) => void
}

export function GeoPickerMap({ lat, lng, radiusM, onChange }: Props) {
  const mapRef  = useRef<HTMLDivElement>(null)
  const mapObj  = useRef<any>(null)
  const marker  = useRef<any>(null)
  const circle  = useRef<any>(null)
  const state   = useRef({ lat, lng, radiusM })

  // keep ref in sync with props
  useEffect(() => { state.current = { lat, lng, radiusM } }, [lat, lng, radiusM])

  useEffect(() => {
    // Load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id   = 'leaflet-css'
      link.rel  = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    const loadLeaflet = () => new Promise<void>(resolve => {
      if ((window as any).L) { resolve(); return }
      const s = document.createElement('script')
      s.src    = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
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

      // Draggable pin
      const pinIcon = L.divIcon({
        className: '',
        html: `<div style="width:20px;height:20px;border-radius:50%;background:#E8531D;border:3px solid white;box-shadow:0 2px 8px rgba(232,83,29,0.5)"></div>`,
        iconSize: [20, 20], iconAnchor: [10, 10],
      })
      marker.current = L.marker([lat || 28.5, lng || 77.2], { icon: pinIcon, draggable: true }).addTo(map)
        .bindPopup('📍 Drag to set location').openPopup()

      circle.current = L.circle([lat || 28.5, lng || 77.2], {
        radius: radiusM, color: '#E8531D', fillColor: '#E8531D', fillOpacity: 0.08,
      }).addTo(map)

      // Click on map → move pin
      map.on('click', (e: any) => {
        const { lat: newLat, lng: newLng } = e.latlng
        marker.current?.setLatLng([newLat, newLng])
        circle.current?.setLatLng([newLat, newLng])
        onChange(newLat, newLng, state.current.radiusM)
      })

      // Drag pin → update
      marker.current.on('dragend', (e: any) => {
        const { lat: newLat, lng: newLng } = e.target.getLatLng()
        circle.current?.setLatLng([newLat, newLng])
        onChange(newLat, newLng, state.current.radiusM)
      })
    })

    return () => {
      mapObj.current?.remove()
      mapObj.current = null
    }
  }, [])

  // Update circle radius when prop changes
  useEffect(() => {
    circle.current?.setRadius(radiusM)
  }, [radiusM])

  // Re-center if lat/lng prop changes externally
  useEffect(() => {
    if (!mapObj.current || !marker.current) return
    marker.current.setLatLng([lat, lng])
    circle.current?.setLatLng([lat, lng])
    mapObj.current.setView([lat, lng], mapObj.current.getZoom())
  }, [lat, lng])

  return <div ref={mapRef} style={{ width: '100%', height: '260px', borderRadius: '12px', overflow: 'hidden' }} />
}
