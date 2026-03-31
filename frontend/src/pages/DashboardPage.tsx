import React, { useMemo, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useQuery } from '@tanstack/react-query';
import { fetchLandingSites, fetchHelicopters, fetchCrew, fetchOperations, fetchFlightOrders } from '@/api/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plane, Users, MapPin, ClipboardList } from 'lucide-react';
import LeafletMap from '@/components/LeafletMap';
import type { MapMarker, MapPolyline } from '@/components/LeafletMap';
import { buildFlightOrderPolylinePositions } from '@/lib/flightOrderRoute';

const ROUTE_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2'];

const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const { data: sites = [] } = useQuery({ queryKey: ['landingSites'], queryFn: fetchLandingSites });
  const { data: helicopters = [] } = useQuery({ queryKey: ['helicopters'], queryFn: fetchHelicopters });
  const { data: crew = [] } = useQuery({ queryKey: ['crew'], queryFn: fetchCrew });
  const { data: operations = [] } = useQuery({ queryKey: ['operations'], queryFn: fetchOperations });
  const { data: flightOrders = [] } = useQuery({ queryKey: ['flightOrders'], queryFn: fetchFlightOrders });

  const [visibleRoutes, setVisibleRoutes] = useState<Record<string, boolean>>({});

  // Default all routes to visible
  const isRouteVisible = (id: string) => visibleRoutes[id] !== false;

  const toggleRoute = (id: string) => {
    setVisibleRoutes(prev => ({ ...prev, [id]: !isRouteVisible(id) }));
  };

  const center: [number, number] = sites.length > 0
    ? [sites.reduce((s, v) => s + v.latitude, 0) / sites.length, sites.reduce((s, v) => s + v.longitude, 0) / sites.length]
    : [50.06, 19.94];

  const markers: MapMarker[] = sites.map(site => ({
    id: site.id,
    lat: site.latitude,
    lng: site.longitude,
    popup: `<strong>${site.name}</strong><br/>Wys.: ${site.elevation} m n.p.m.<br/>Status: ${site.status}<br/><small>${site.latitude.toFixed(4)}, ${site.longitude.toFixed(4)}</small>`,
  }));

  const routePolylines: MapPolyline[] = useMemo(() => {
    return flightOrders
      .map((order, i) => {
        if (!isRouteVisible(order.id)) return null;
        const positions = buildFlightOrderPolylinePositions(order, sites, operations);
        if (!positions || positions.length < 2) return null;
        return {
          positions,
          color: ROUTE_COLORS[i % ROUTE_COLORS.length],
          weight: 3,
        };
      })
      .filter(Boolean) as MapPolyline[];
  }, [flightOrders, sites, operations, visibleRoutes]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Witaj, {user?.name}!</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Helikoptery</CardTitle>
            <Plane className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{helicopters.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Załoga</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{crew.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lądowiska</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{sites.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operacje</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{operations.length}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mapa lądowisk i tras lotów</CardTitle>
        </CardHeader>
        <CardContent>
          <LeafletMap center={center} zoom={8} markers={markers} polylines={routePolylines} className="h-[500px]" />
          {flightOrders.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-3">
              {flightOrders.map((order, i) => {
                const startName = sites.find(s => s.id === order.startSiteId)?.name ?? '?';
                const endName = sites.find(s => s.id === order.endSiteId)?.name ?? '?';
                return (
                  <button
                    key={order.id}
                    onClick={() => toggleRoute(order.id)}
                    className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border transition-colors ${
                      isRouteVisible(order.id)
                        ? 'border-border bg-muted text-foreground'
                        : 'border-transparent bg-transparent text-muted-foreground line-through opacity-50'
                    }`}
                  >
                    <span className="inline-block w-4 h-1 rounded" style={{ backgroundColor: ROUTE_COLORS[i % ROUTE_COLORS.length] }} />
                    {startName} → {endName}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;
