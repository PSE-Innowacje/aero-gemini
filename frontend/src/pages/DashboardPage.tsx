import React, { useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useQuery } from '@tanstack/react-query';
import { fetchLandingSites, fetchHelicopters, fetchCrew, fetchOperations, fetchFlightOrders } from '@/api/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plane, Users, MapPin, ClipboardList, CalendarClock, ShieldCheck } from 'lucide-react';
import LeafletMap from '@/components/LeafletMap';
import type { MapMarker } from '@/components/LeafletMap';
import { useNavigate } from 'react-router-dom';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: sites = [] } = useQuery({ queryKey: ['landingSites'], queryFn: fetchLandingSites });
  const { data: helicopters = [] } = useQuery({ queryKey: ['helicopters'], queryFn: fetchHelicopters });
  const { data: crew = [] } = useQuery({ queryKey: ['crew'], queryFn: fetchCrew });
  const { data: operations = [] } = useQuery({ queryKey: ['operations'], queryFn: fetchOperations });
  const { data: flightOrders = [] } = useQuery({ queryKey: ['flightOrders'], queryFn: fetchFlightOrders });
  const activeHelicopters = helicopters.filter((h) => h.status === 'active').length;
  const pendingOrders = flightOrders.filter((o) => o.status === 1 || o.status === 2).length;
  const completedOrders = flightOrders.filter((o) => o.status === 5 || o.status === 6).length;
  const nextFlight = useMemo(
    () =>
      flightOrders
        .filter((order) => order.plannedStart)
        .sort((a, b) => new Date(a.plannedStart).getTime() - new Date(b.plannedStart).getTime())[0] ?? null,
    [flightOrders]
  );

  const polandBounds: [[number, number], [number, number]] = [[49.0, 14.1], [54.9, 24.2]];

  const markers: MapMarker[] = sites.map(site => ({
    id: site.id,
    lat: site.latitude,
    lng: site.longitude,
    popup: `<strong>${site.name}</strong><br/>Wys.: ${site.elevation} m n.p.m.<br/>Status: ${site.status}<br/><small>${site.latitude.toFixed(4)}, ${site.longitude.toFixed(4)}</small>`,
  }));

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col overflow-hidden">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="min-h-0 xl:col-span-1 xl:flex xl:flex-col xl:gap-4">
          <section className="rounded-2xl border border-border/60 bg-gradient-to-br from-background via-background to-muted/40 p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Panel glowny</p>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Witaj, {user?.name}!</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Aktualny podglad zasobow lotniczych, zalogi i zlecen.
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl border border-border/70 bg-card/70 px-4 py-3 text-left transition hover:bg-accent/40 disabled:cursor-default disabled:hover:bg-card/70"
                disabled={!nextFlight}
                onClick={() => nextFlight && navigate(`/flight-orders?focusOrderId=${nextFlight.id}`)}
              >
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Najblizszy lot</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {nextFlight ? new Date(nextFlight.plannedStart).toLocaleString('pl-PL') : 'Brak zaplanowanych lotow'}
                </p>
              </button>
            </div>
          </section>

          <Card className="min-h-0 border-border/60 bg-card/80 xl:flex-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Skróty i statystyki</CardTitle>
            <p className="text-sm text-muted-foreground">Kliknij kartę, aby przejść do odpowiedniego widoku.</p>
          </CardHeader>
            <CardContent className="min-h-0 xl:h-[calc(100%-4.5rem)]">
              <div className="grid max-h-[40vh] grid-cols-1 gap-3 overflow-auto pr-1 md:grid-cols-2 xl:h-full xl:max-h-none">
              <Card
                className="cursor-pointer border-border/60 bg-card/80 backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => navigate('/helicopters?status=active')}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Helikoptery aktywne</CardTitle>
                  <Plane className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">{activeHelicopters}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Lacznie: {helicopters.length}</p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer border-border/60 bg-card/80 backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => navigate('/crew')}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Zaloga</CardTitle>
                  <Users className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">{crew.length}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Dostepni czlonkowie zespolu</p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer border-border/60 bg-card/80 backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => navigate('/landing-sites')}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Ladowiska</CardTitle>
                  <MapPin className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">{sites.length}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Punkty startu i ladowania</p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer border-border/60 bg-card/80 backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => navigate('/operations')}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Operacje</CardTitle>
                  <ClipboardList className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">{operations.length}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Zaplanowane aktywnosci</p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer border-border/60 bg-card/80 backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => navigate('/flight-orders?status=pending')}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Zlecenia oczekujace</CardTitle>
                  <CalendarClock className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">{pendingOrders}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Status: wprowadzone i przekazane</p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer border-border/60 bg-card/80 backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => navigate('/flight-orders?status=completed')}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Loty zakonczone</CardTitle>
                  <ShieldCheck className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">{completedOrders}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Status: zrealizowane</p>
                </CardContent>
              </Card>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="min-h-0 border-border/60 bg-card/80 xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Mapa ladowisk</CardTitle>
            <p className="text-sm text-muted-foreground">Widok domyslny: Polska.</p>
          </CardHeader>
          <CardContent className="h-[calc(100%-4.5rem)] min-h-0">
            <LeafletMap bounds={polandBounds} markers={markers} className="h-full rounded-xl" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
