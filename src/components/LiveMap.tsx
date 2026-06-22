import { useEffect, useRef } from 'react'

interface Props {
  lat: number
  lng: number
  targetLat?: number
  targetLng?: number
  radiusM?: number
  onUpdate?: (lat: number, lng: number, dist: number) => void
}

export function LiveMap({ lat, lng, targetLat, targetLng, radiusM, onUpdate }: Props) {
  const mapRef   = useRef<HTMLDivElement>(null)
  const mapObj   = useRef<any>(null)
  const marker   = useRef<any>(null)
  const circle   = useRef<any>(null)
  const watchId  = useRef<number | null>(null)

  useEffect(() => {
    // Load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    // Load Leaflet JS
    const loadLeaflet = () => new Promise<void>(resolve => {
      if ((window as any).L) { resolve(); return }
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = () => resolve()
      document.head.appendChild(script)
    })

    loadLeaflet().then(() => {
      if (!mapRef.current || mapObj.current) return
      const L = (window as any).L

      // Init map
      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView([lat, lng], 17)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
      mapObj.current = map

      // Pulsing current location marker
      const pulseIcon = L.divIcon({
        className: '',
        html: `<div style="width:16px;height:16px;border-radius:50%;background:#E8531D;border:3px solid white;box-shadow:0 0 0 4px rgba(232,83,29,0.3);animation:pulse 1.5s infinite"></div>`,
        iconSize: [16, 16], iconAnchor: [8, 8],
      })
      marker.current = L.marker([lat, lng], { icon: pulseIcon }).addTo(map)
        .bindPopup('📍 Your location').openPopup()

      // Target circle (office/CMK)
      if (targetLat && targetLng && radiusM) {
        L.circleMarker([targetLat, targetLng], { radius: 8, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.5 })
          .addTo(map).bindPopup('🏢 Required location')
        circle.current = L.circle([targetLat, targetLng], { radius: radiusM, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.08 }).addTo(map)
      }

      // Add pulse keyframes
      if (!document.getElementById('pulse-style')) {
        const style = document.createElement('style')
        style.id = 'pulse-style'
        style.textContent = `@keyframes pulse { 0%,100% { box-shadow: 0 0 0 4px rgba(232,83,29,0.3) } 50% { box-shadow: 0 0 0 8px rgba(232,83,29,0.1) } }`
        document.head.appendChild(style)
      }

      // Live watch
      if (navigator.geolocation) {
        watchId.current = navigator.geolocation.watchPosition(pos => {
          const { latitude, longitude } = pos.coords
          marker.current?.setLatLng([latitude, longitude])
          map.setView([latitude, longitude], map.getZoom())

          if (targetLat && targetLng && radiusM && onUpdate) {
            const R = 6371000
            const dLat = (targetLat - latitude) * Math.PI / 180
            const dLng = (targetLng - longitude) * Math.PI / 180
            const a = Math.sin(dLat/2)**2 + Math.cos(latitude*Math.PI/180)*Math.cos(targetLat*Math.PI/180)*Math.sin(dLng/2)**2
            const dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)))
            onUpdate(latitude, longitude, dist)
          }
        }, () => {}, { enableHighAccuracy: true, maximumAge: 3000 })
      }
    })

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
      mapObj.current?.remove()
      mapObj.current = null
    }
  }, [])

  return <div ref={mapRef} style={{ width: '100%', height: '180px' }} />
}
