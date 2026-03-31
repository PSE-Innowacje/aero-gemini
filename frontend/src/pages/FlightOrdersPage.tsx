import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchFlightOrders, createFlightOrder, updateFlightOrder, fetchHelicopters, fetchCrew, fetchLandingSites, fetchOperations } from '@/api/api';
import type { FlightOrder, FlightOrderStatus } from '@/types';
import { flightOrderStatusLabels } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Eye, AlertTriangle } from 'lucide-react';
import LeafletMap from '@/components/LeafletMap';
import type { MapMarker, MapPolyline } from '@/components/LeafletMap';
import { buildFlightOrderPolylinePositions } from '@/lib/flightOrderRoute';

const statusColors: Record<FlightOrderStatus, string> = {
  1: 'bg-muted text-muted-foreground',
  2: 'bg-blue-100 text-blue-800',
  3: 'bg-green-100 text-green-800',
  4: 'bg-purple-100 text-purple-800',
};

const FlightOrdersPage: React.FC = () => {
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({ queryKey: ['flightOrders'], queryFn: fetchFlightOrders });
  const { data: helicopters = [] } = useQuery({ queryKey: ['helicopters'], queryFn: fetchHelicopters });
  const { data: crew = [] } = useQuery({ queryKey: ['crew'], queryFn: fetchCrew });
  const { data: sites = [] } = useQuery({ queryKey: ['landingSites'], queryFn: fetchLandingSites });
  const { data: operations = [] } = useQuery({ queryKey: ['operations'], queryFn: fetchOperations });

  const [statusFilter, setStatusFilter] = useState<string>('2');
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<FlightOrder | null>(null);
  const [viewing, setViewing] = useState<FlightOrder | null>(null);
  const [form, setForm] = useState({
    startTime: '', helicopterId: '', pilotId: '', crewIds: [] as string[],
    landingSiteIds: [] as string[], operationIds: [] as string[], status: 1 as FlightOrderStatus,
    startSiteId: '', endSiteId: '',
  });

  const createMut = useMutation({
    mutationFn: (d: Omit<FlightOrder, 'id'>) => createFlightOrder(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['flightOrders'] }); setOpen(false); toast({ title: 'Dodano zlecenie' }); },
    onError: (error: Error) => { toast({ title: 'Nie udało się dodać zlecenia', description: error.message, variant: 'destructive' }); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: Partial<FlightOrder> & { id: string }) => updateFlightOrder(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['flightOrders'] }); setOpen(false); toast({ title: 'Zaktualizowano' }); },
    onError: (error: Error) => { toast({ title: 'Nie udało się zaktualizować zlecenia', description: error.message, variant: 'destructive' }); },
  });

  const filtered = statusFilter === 'all' ? orders : orders.filter(o => o.status === Number(statusFilter));

  const getHelicopterName = (id: string) => helicopters.find(h => h.id === id)?.registration ?? id;
  const getPilotName = (id: string) => crew.find(c => c.id === id)?.name ?? id;
  const getSiteName = (id: string) => sites.find(s => s.id === id)?.name ?? id;

  const openCreate = () => {
    setEditing(null);
    setForm({ startTime: '', helicopterId: '', pilotId: '', crewIds: [], landingSiteIds: [], operationIds: [], status: 1, startSiteId: '', endSiteId: '' });
    setOpen(true);
  };
  const openEdit = (o: FlightOrder) => {
    setEditing(o);
    setForm({ startTime: o.startTime, helicopterId: o.helicopterId, pilotId: o.pilotId, crewIds: o.crewIds, landingSiteIds: o.landingSiteIds, operationIds: o.operationIds, status: o.status, startSiteId: o.startSiteId, endSiteId: o.endSiteId });
    setOpen(true);
  };

  const toggleMulti = (key: 'crewIds' | 'landingSiteIds' | 'operationIds', id: string) => {
    setForm(f => ({ ...f, [key]: f[key].includes(id) ? f[key].filter(x => x !== id) : [...f[key], id] }));
  };

  const crewWeight = useMemo(() => {
    const pilot = crew.find(c => c.id === form.pilotId);
    const members = crew.filter(c => form.crewIds.includes(c.id));
    return (pilot?.weight ?? 0) + members.reduce((s, c) => s + c.weight, 0);
  }, [form.pilotId, form.crewIds, crew]);

  const helicopter = helicopters.find(h => h.id === form.helicopterId);
  const overweight = helicopter ? crewWeight > helicopter.maxWeight * 0.3 : false;

  const expiredLicenses = useMemo(() => {
    const ids = [form.pilotId, ...form.crewIds];
    return crew.filter(c => ids.includes(c.id) && new Date(c.licenseExpiry) < new Date());
  }, [form.pilotId, form.crewIds, crew]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) updateMut.mutate({ id: editing.id, ...form });
    else createMut.mutate(form);
  };

  // Map data for detail view
  const viewingMarkers: MapMarker[] = useMemo(() => {
    if (!viewing) return [];
    return [viewing.startSiteId, viewing.endSiteId]
      .map(id => sites.find(s => s.id === id))
      .filter(Boolean)
      .map(s => ({ id: s!.id, lat: s!.latitude, lng: s!.longitude, popup: s!.name }));
  }, [viewing, sites]);

  const viewingPolylines: MapPolyline[] = useMemo(() => {
    if (!viewing) return [];
    const positions = buildFlightOrderPolylinePositions(viewing, sites, operations);
    if (!positions || positions.length < 2) return [];
    return [{ positions }];
  }, [viewing, sites, operations]);

  const viewingCenter: [number, number] = viewingMarkers.length > 0
    ? [viewingMarkers[0].lat, viewingMarkers[0].lng]
    : [50.06, 19.94];

  if (isLoading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Zlecenia na lot</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Dodaj</Button>
      </div>

      <div className="flex gap-2 items-center">
        <span className="text-sm text-muted-foreground">Status:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie</SelectItem>
            {([1, 2, 3, 4] as FlightOrderStatus[]).map(s => (
              <SelectItem key={s} value={String(s)}>{flightOrderStatusLabels[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>Helikopter</TableHead>
              <TableHead>Pilot</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(o => (
              <TableRow key={o.id}>
                <TableCell>{o.id}</TableCell>
                <TableCell className="text-sm">{new Date(o.startTime).toLocaleString('pl-PL')}</TableCell>
                <TableCell>{getHelicopterName(o.helicopterId)}</TableCell>
                <TableCell>{getPilotName(o.pilotId)}</TableCell>
                <TableCell>
                  <Select value={String(o.status)} onValueChange={v => updateMut.mutate({ id: o.id, status: Number(v) as FlightOrderStatus })}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {([1, 2, 3, 4] as FlightOrderStatus[]).map(s => (
                        <SelectItem key={s} value={String(s)}>{flightOrderStatusLabels[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setViewing(o); setDetailOpen(true); }}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(o)}><Pencil className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edytuj zlecenie' : 'Nowe zlecenie'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input type="datetime-local" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} required />

            <div>
              <label className="text-sm font-medium text-foreground">Helikopter</label>
              <Select value={form.helicopterId} onValueChange={v => setForm(f => ({ ...f, helicopterId: v }))}>
                <SelectTrigger><SelectValue placeholder="Wybierz helikopter" /></SelectTrigger>
                <SelectContent>
                  {helicopters.filter(h => h.status === 'active').map(h => (
                    <SelectItem key={h.id} value={h.id}>{h.registration} ({h.type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Pilot</label>
              <Select value={form.pilotId} onValueChange={v => setForm(f => ({ ...f, pilotId: v }))}>
                <SelectTrigger><SelectValue placeholder="Wybierz pilota" /></SelectTrigger>
                <SelectContent>
                  {crew.filter(c => c.role === 'PILOT').map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Załoga</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {crew.filter(c => c.id !== form.pilotId).map(c => (
                  <Badge key={c.id} className={`cursor-pointer ${form.crewIds.includes(c.id) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`} onClick={() => toggleMulti('crewIds', c.id)}>
                    {c.name} ({c.weight}kg)
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium text-foreground">Lądowisko startowe</label>
                <Select value={form.startSiteId} onValueChange={v => setForm(f => ({ ...f, startSiteId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Start" /></SelectTrigger>
                  <SelectContent>
                    {sites.filter(s => s.status === 'active').map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Lądowisko docelowe</label>
                <Select value={form.endSiteId} onValueChange={v => setForm(f => ({ ...f, endSiteId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Cel" /></SelectTrigger>
                  <SelectContent>
                    {sites.filter(s => s.status === 'active').map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Operacje</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {operations.map(o => (
                  <Badge key={o.id} className={`cursor-pointer ${form.operationIds.includes(o.id) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`} onClick={() => toggleMulti('operationIds', o.id)}>
                    {o.projectCode}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-md bg-muted space-y-1 text-sm">
              <p><span className="text-muted-foreground">Waga załogi:</span> <strong>{crewWeight} kg</strong></p>
              {helicopter && <p><span className="text-muted-foreground">Maks. zasięg:</span> {helicopter.maxRange} km</p>}
            </div>

            {overweight && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4" /> Przekroczono dopuszczalną masę załogi!
              </div>
            )}
            {expiredLicenses.length > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4" /> Wygasła licencja: {expiredLicenses.map(c => c.name).join(', ')}
              </div>
            )}

            <Button type="submit" className="w-full">{editing ? 'Zapisz' : 'Dodaj'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail view with map */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Zlecenie #{viewing?.id}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Start:</span> {new Date(viewing.startTime).toLocaleString('pl-PL')}</div>
                <div><span className="text-muted-foreground">Helikopter:</span> {getHelicopterName(viewing.helicopterId)}</div>
                <div><span className="text-muted-foreground">Pilot:</span> {getPilotName(viewing.pilotId)}</div>
                <div><span className="text-muted-foreground">Status:</span> <Badge className={statusColors[viewing.status]}>{flightOrderStatusLabels[viewing.status]}</Badge></div>
                <div><span className="text-muted-foreground">Start:</span> {getSiteName(viewing.startSiteId)}</div>
                <div><span className="text-muted-foreground">Cel:</span> {getSiteName(viewing.endSiteId)}</div>
              </div>

              {viewingMarkers.length > 0 && (
                <LeafletMap
                  center={viewingCenter}
                  zoom={8}
                  markers={viewingMarkers}
                  polylines={viewingPolylines}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FlightOrdersPage;
