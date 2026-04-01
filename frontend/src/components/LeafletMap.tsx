import React, { useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;

const defaultIcon = new L.Icon({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const siteIcon = L.divIcon({
  className: 'leaflet-marker-site',
  html: '<span class="marker-dot"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -10],
});

const siteStartIcon = L.divIcon({
  className: 'leaflet-marker-site-start',
  html: '<span class="marker-dot"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -10],
});

const siteEndIcon = L.divIcon({
  className: 'leaflet-marker-site-end',
  html: '<span class="marker-dot"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -10],
});

const operationDotIcon = L.divIcon({
  className: 'leaflet-marker-operation-dot',
  html: '<span class="marker-dot"></span>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -8],
});

const highlightIcon = new L.Icon({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [35, 57],
  iconAnchor: [17, 57],
  popupAnchor: [1, -45],
  shadowSize: [57, 57],
  className: 'leaflet-marker-highlighted',
});

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  popup?: string;
  markerType?: 'default' | 'site' | 'site-start' | 'site-end' | 'operation';
}

export interface MapPolyline {
  positions: [number, number][];
  color?: string;
  weight?: number;
}

interface LeafletMapProps {
  center?: [number, number];
  zoom?: number;
  bounds?: [[number, number], [number, number]];
  markers?: MapMarker[];
  polylines?: MapPolyline[];
  className?: string;
  onClick?: (lat: number, lng: number) => void;
  onMarkerClick?: (markerId: string) => void;
  selectedMarkerId?: string | null;
  autoFitBounds?: boolean;
}

const LeafletMap: React.FC<LeafletMapProps> = ({
  center = [52.0, 19.0],
  zoom = 7,
  bounds,
  markers = [],
  polylines = [],
  className = 'h-[300px]',
  onClick,
  onMarkerClick,
  selectedMarkerId,
  autoFitBounds = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylinesRef = useRef<L.Polyline[]>([]);

  const getThemeTileConfig = () => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      return {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO',
        subdomains: ['a', 'b', 'c', 'd'] as string[],
      };
    }
    return {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      // OSM serves tiles on a/b/c. Using "d" causes empty/gray tiles.
      subdomains: ['a', 'b', 'c'] as string[],
    };
  };

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(center, zoom);
    if (bounds) {
      map.fitBounds(bounds, { padding: [12, 12] });
    }
    const tileConfig = getThemeTileConfig();
    tileLayerRef.current = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      subdomains: tileConfig.subdomains,
      maxZoom: 20,
    }).addTo(map);
    mapRef.current = map;

    return () => {
      tileLayerRef.current?.remove();
      tileLayerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update tile layer on theme change (light/dark).
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const map = mapRef.current;
      if (!map) return;
      tileLayerRef.current?.remove();
      const tileConfig = getThemeTileConfig();
      tileLayerRef.current = L.tileLayer(tileConfig.url, {
        attribution: tileConfig.attribution,
        subdomains: tileConfig.subdomains,
        maxZoom: 20,
      }).addTo(map);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle click
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onClick) return;
    const handler = (e: L.LeafletMouseEvent) => onClick(e.latlng.lat, e.latlng.lng);
    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [onClick]);

  // Update center
  useEffect(() => {
    if (bounds) return;
    mapRef.current?.setView(center, mapRef.current.getZoom());
  }, [center, bounds]);

  // Update bounds
  useEffect(() => {
    if (!bounds) return;
    mapRef.current?.fitBounds(bounds, { padding: [12, 12] });
  }, [bounds]);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = markers.map(m => {
      const isSelected = selectedMarkerId === m.id;
      const markerIcon =
        m.markerType === 'operation'
          ? operationDotIcon
          : m.markerType === 'site-start'
            ? siteStartIcon
            : m.markerType === 'site-end'
              ? siteEndIcon
              : m.markerType === 'site'
                ? siteIcon
                : defaultIcon;
      const marker = L.marker([m.lat, m.lng], {
        icon: isSelected ? highlightIcon : markerIcon,
        zIndexOffset: isSelected ? 1000 : 0,
      }).addTo(map);
      if (m.popup) marker.bindPopup(m.popup);
      if (onMarkerClick) {
        marker.on('click', () => onMarkerClick(m.id));
      }
      if (isSelected) marker.openPopup();
      return marker;
    });
  }, [markers, selectedMarkerId, onMarkerClick]);

  // Update polylines
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    polylinesRef.current.forEach(p => p.remove());
    polylinesRef.current = polylines.map(p =>
      L.polyline(p.positions, { color: p.color || '#1e293b', weight: p.weight || 3 }).addTo(map)
    );
  }, [polylines]);

  // Optional auto-fit for dynamic previews.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !autoFitBounds) return;
    const points: [number, number][] = [
      ...markers.map((marker) => [marker.lat, marker.lng] as [number, number]),
      ...polylines.flatMap((polyline) => polyline.positions),
    ];
    if (points.length < 2) return;
    map.fitBounds(L.latLngBounds(points), { padding: [24, 24] });
  }, [autoFitBounds, markers, polylines]);

  return <div ref={containerRef} className={`${className} rounded-lg overflow-hidden border border-border z-0`} />;
};

export default LeafletMap;
