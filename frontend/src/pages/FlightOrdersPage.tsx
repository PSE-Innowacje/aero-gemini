import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchFlightOrders,
  createFlightOrder,
  deleteFlightOrder,
  updateFlightOrder,
  fetchHelicopters,
  fetchCrew,
  fetchLandingSites,
  fetchOperations,
  previewFlightOrderRoute,
} from '@/api/api';
import type { FlightOrder, FlightOrderStatus, Role } from '@/types';
import { flightOrderStatusLabels } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Eye, AlertTriangle, Trash2 } from 'lucide-react';
import LeafletMap from '@/components/LeafletMap';
import type { MapMarker, MapPolyline } from '@/components/LeafletMap';
import {
  buildFlightOrderPolylinePositions,
  buildFlightPreviewPolylinePositions,
  buildFlightPreviewRouteVisuals,
  buildFlightPreviewRouteVisualsFromOrderedOperations,
} from '@/lib/flightOrderRoute';
import { useAuthStore } from '@/store/authStore';
import { useSearchParams } from 'react-router-dom';

const statusColors: Record<FlightOrderStatus, string> = {
  1: 'bg-slate-100 text-slate-800',
  2: 'bg-blue-100 text-blue-800',
  3: 'bg-red-100 text-red-800',
  4: 'bg-emerald-100 text-emerald-800',
  5: 'bg-violet-100 text-violet-800',
  6: 'bg-green-100 text-green-800',
  7: 'bg-zinc-200 text-zinc-800',
};

const getAllowedStatusOptions = (
  currentStatus: FlightOrderStatus,
  role: Role | undefined
): FlightOrderStatus[] => {
  if (!role) return [currentStatus];

  if (role === 'PILOT') {
    if (currentStatus === 1) return [1, 2];
    if (currentStatus === 4) return [4, 5, 6, 7];
    return [currentStatus];
  }

  if (role === 'SUPERVISOR') {
    if (currentStatus === 2) return [2, 3, 4];
    return [currentStatus];
  }

  if (role === 'ADMIN') return [1, 2, 3, 4, 5, 6, 7];
  return [currentStatus];
};

const toLocalDateTimeValue = (value?: string): string => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.includes('T') ? value.slice(0, 16) : '';
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getDatePart = (value: string): string => {
  const normalized = toLocalDateTimeValue(value);
  if (!normalized.includes('T')) return '';
  return normalized.split('T')[0] ?? '';
};

const getTimePart = (value: string): string => {
  const normalized = toLocalDateTimeValue(value);
  if (!normalized.includes('T')) return '';
  return normalized.split('T')[1] ?? '';
};

const mergeDateTimeParts = (
  currentValue: string,
  patch: { date?: string; time?: string }
): string => {
  const normalized = toLocalDateTimeValue(currentValue);
  const [currentDate = '', currentTime = ''] = normalized ? normalized.split('T') : ['', ''];
  const nextDate = patch.date ?? currentDate;
  const nextTime = patch.time ?? currentTime;
  if (!nextDate) return '';
  return `${nextDate}T${nextTime || '00:00'}`;
};

const FlightOrdersPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({ queryKey: ['flightOrders'], queryFn: fetchFlightOrders });
  const { data: helicopters = [] } = useQuery({ queryKey: ['helicopters'], queryFn: fetchHelicopters });
  const { data: crew = [] } = useQuery({ queryKey: ['crew'], queryFn: fetchCrew });
  const { data: sites = [] } = useQuery({ queryKey: ['landingSites'], queryFn: fetchLandingSites });
  const { data: operations = [] } = useQuery({ queryKey: ['operations'], queryFn: fetchOperations });

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<FlightOrder | null>(null);
  const [viewing, setViewing] = useState<FlightOrder | null>(null);
  const [handledFocusOrderId, setHandledFocusOrderId] = useState<string>('');
  const [pendingDeleteOrder, setPendingDeleteOrder] = useState<FlightOrder | null>(null);
  const [form, setForm] = useState({
    plannedStart: '', plannedEnd: '', actualStart: '', actualEnd: '', helicopterId: '', pilotId: '', crewIds: [] as string[],
    landingSiteIds: [] as string[], operationIds: [] as string[], status: 1 as FlightOrderStatus,
    startSiteId: '', endSiteId: '',
  });
  const [debouncedPreviewInput, setDebouncedPreviewInput] = useState<{
    startSiteId: string;
    endSiteId: string;
    helicopterId: string;
    operationIds: string[];
  }>({
    startSiteId: '',
    endSiteId: '',
    helicopterId: '',
    operationIds: [],
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
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFlightOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flightOrders'] });
      toast({ title: 'Usunieto zlecenie' });
    },
    onError: (error: Error) => {
      toast({ title: 'Nie udalo sie usunac zlecenia', description: error.message, variant: 'destructive' });
    },
  });

  useEffect(() => {
    const statusFromUrl = searchParams.get('status');
    if (!statusFromUrl) {
      setStatusFilter('all');
      return;
    }
    if (statusFromUrl === 'pending' || statusFromUrl === 'completed' || statusFromUrl === 'all') {
      setStatusFilter(statusFromUrl);
      return;
    }
    const asNumber = Number(statusFromUrl);
    if ([1, 2, 3, 4, 5, 6, 7].includes(asNumber)) {
      setStatusFilter(String(asNumber));
      return;
    }
    setStatusFilter('all');
  }, [searchParams]);

  useEffect(() => {
    const focusOrderId = searchParams.get('focusOrderId');
    if (!focusOrderId || focusOrderId === handledFocusOrderId || orders.length === 0) return;
    const order = orders.find((item) => item.id === focusOrderId);
    if (!order) return;
    setViewing(order);
    setDetailOpen(true);
    setHandledFocusOrderId(focusOrderId);
  }, [searchParams, orders, handledFocusOrderId]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return orders;
    if (statusFilter === 'pending') return orders.filter((o) => o.status === 1 || o.status === 2);
    if (statusFilter === 'completed') return orders.filter((o) => o.status === 5 || o.status === 6);
    return orders.filter((o) => o.status === Number(statusFilter));
  }, [orders, statusFilter]);

  const getHelicopterName = (id: string) => helicopters.find(h => h.id === id)?.registration ?? id;
  const getPilotName = (id: string) => crew.find(c => c.id === id)?.name ?? id;
  const getSiteName = (id: string) => sites.find(s => s.id === id)?.name ?? id;
  const loggedPilotId = useMemo(
    () => crew.find(c => c.role === 'PILOT' && user?.email && c.email === user.email)?.id ?? '',
    [crew, user?.email]
  );
  const effectivePilotId = editing ? form.pilotId : (loggedPilotId || form.pilotId);

  const openCreate = () => {
    setEditing(null);
    setForm({
      plannedStart: '',
      plannedEnd: '',
      actualStart: '',
      actualEnd: '',
      helicopterId: '',
      pilotId: '',
      crewIds: [],
      landingSiteIds: [],
      operationIds: [],
      status: 1,
      startSiteId: '',
      endSiteId: '',
    });
    setOpen(true);
  };
  const openEdit = (o: FlightOrder) => {
    setEditing(o);
    setForm({
      plannedStart: o.plannedStart,
      plannedEnd: o.plannedEnd,
      actualStart: o.actualStart ?? '',
      actualEnd: o.actualEnd ?? '',
      helicopterId: o.helicopterId,
      pilotId: o.pilotId,
      crewIds: o.crewIds,
      landingSiteIds: o.landingSiteIds,
      operationIds: o.operationIds,
      status: o.status,
      startSiteId: o.startSiteId,
      endSiteId: o.endSiteId,
    });
    setOpen(true);
  };

  const toggleMulti = (key: 'crewIds' | 'landingSiteIds' | 'operationIds', id: string) => {
    setForm(f => ({ ...f, [key]: f[key].includes(id) ? f[key].filter(x => x !== id) : [...f[key], id] }));
  };

  const crewWeight = useMemo(() => {
    const pilot = crew.find(c => c.id === effectivePilotId);
    const members = crew.filter(c => form.crewIds.includes(c.id));
    return (pilot?.weight ?? 0) + members.reduce((s, c) => s + c.weight, 0);
  }, [effectivePilotId, form.crewIds, crew]);

  const helicopter = helicopters.find(h => h.id === form.helicopterId);
  const overweight = helicopter ? crewWeight > helicopter.maxWeight : false;

  const expiredLicenses = useMemo(() => {
    const ids = [effectivePilotId, ...form.crewIds];
    return crew.filter(c => ids.includes(c.id) && new Date(c.licenseExpiry) < new Date());
  }, [effectivePilotId, form.crewIds, crew]);

  useEffect(() => {
    if (!open) {
      setDebouncedPreviewInput({
        startSiteId: '',
        endSiteId: '',
        helicopterId: '',
        operationIds: [],
      });
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setDebouncedPreviewInput({
        startSiteId: form.startSiteId,
        endSiteId: form.endSiteId,
        helicopterId: form.helicopterId,
        operationIds: [...form.operationIds],
      });
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [open, form.startSiteId, form.endSiteId, form.helicopterId, form.operationIds]);

  const canPreviewRoute =
    open &&
    !editing &&
    !!debouncedPreviewInput.startSiteId &&
    !!debouncedPreviewInput.endSiteId &&
    !!debouncedPreviewInput.helicopterId;
  const {
    data: previewRoute,
    isFetching: isPreviewRouteLoading,
    isError: isPreviewRouteError,
  } = useQuery({
    queryKey: [
      'flightOrderPreview',
      debouncedPreviewInput.startSiteId,
      debouncedPreviewInput.endSiteId,
      debouncedPreviewInput.helicopterId,
      debouncedPreviewInput.operationIds,
    ],
    queryFn: ({ signal }) =>
      previewFlightOrderRoute(
        {
          startSiteId: debouncedPreviewInput.startSiteId,
          endSiteId: debouncedPreviewInput.endSiteId,
          helicopterId: debouncedPreviewInput.helicopterId,
          operationIds: debouncedPreviewInput.operationIds,
          strategy: 'optimized',
        },
        signal
      ),
    enabled: canPreviewRoute,
  });

  const canPreviewViewingRoute =
    detailOpen &&
    !!viewing &&
    !!viewing.startSiteId &&
    !!viewing.endSiteId &&
    !!viewing.helicopterId;
  const { data: viewingPreviewRoute } = useQuery({
    queryKey: [
      'flightOrderViewingPreview',
      viewing?.id,
      viewing?.startSiteId,
      viewing?.endSiteId,
      viewing?.helicopterId,
      viewing?.operationIds,
    ],
    queryFn: ({ signal }) =>
      previewFlightOrderRoute(
        {
          startSiteId: viewing!.startSiteId,
          endSiteId: viewing!.endSiteId,
          helicopterId: viewing!.helicopterId,
          operationIds: viewing!.operationIds,
          strategy: 'optimized',
        },
        signal
      ),
    enabled: canPreviewViewingRoute,
  });

  const previewOperationIds = previewRoute?.orderedOperationIds?.length
    ? previewRoute.orderedOperationIds
    : form.operationIds;
  const previewOrderedOperations = previewRoute?.orderedOperations ?? [];

  const formPreviewRouteVisuals = useMemo(() => {
    if (previewOrderedOperations.length > 0) {
      return buildFlightPreviewRouteVisualsFromOrderedOperations(
        form.startSiteId,
        form.endSiteId,
        previewOrderedOperations,
        sites,
        operations
      );
    }
    return buildFlightPreviewRouteVisuals(
      form.startSiteId,
      form.endSiteId,
      previewOperationIds,
      sites,
      operations
    );
  }, [
    form.startSiteId,
    form.endSiteId,
    previewOrderedOperations,
    previewOperationIds,
    sites,
    operations,
  ]);

  const formPreviewMarkers: MapMarker[] = useMemo(() => {
    if (!form.startSiteId || !form.endSiteId) return [];
    const siteMarkers = [form.startSiteId, form.endSiteId]
      .map((id) => sites.find((site) => site.id === id))
      .filter(Boolean)
      .map((site) => ({
        id: `site-${site!.id}`,
        lat: site!.latitude,
        lng: site!.longitude,
        popup: site!.name,
        markerType: 'site' as const,
      }));
    const operationMarkers = formPreviewRouteVisuals?.operationMarkers ?? [];
    return [...siteMarkers, ...operationMarkers];
  }, [form.startSiteId, form.endSiteId, sites, formPreviewRouteVisuals]);

  const formPreviewPolylines: MapPolyline[] = useMemo(() => {
    if (formPreviewRouteVisuals) {
      return [
        ...formPreviewRouteVisuals.transitPolylines
          .filter((positions) => positions.length >= 2)
          .map((positions) => ({ positions, color: '#0f766e', weight: 4 })),
        ...formPreviewRouteVisuals.operationPolylines
          .filter((positions) => positions.length >= 2)
          .map((positions) => ({ positions, color: '#f97316', weight: 5 })),
      ];
    }

    const positions = buildFlightPreviewPolylinePositions(
      form.startSiteId,
      form.endSiteId,
      previewOperationIds,
      sites,
      operations
    );
    if (!positions || positions.length < 2) return [];
    return [{ positions, color: '#0f766e', weight: 4 }];
  }, [form.startSiteId, form.endSiteId, previewOperationIds, sites, operations, formPreviewRouteVisuals]);

  const previewCenter: [number, number] =
    formPreviewMarkers.length > 0 ? [formPreviewMarkers[0].lat, formPreviewMarkers[0].lng] : [50.06, 19.94];

  const isRangeExceeded = Boolean(canPreviewRoute && previewRoute && !previewRoute.withinHelicopterRange);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.plannedStart && form.plannedEnd && new Date(form.plannedEnd) <= new Date(form.plannedStart)) {
      toast({
        title: 'Nieprawidlowe daty planowane',
        description: 'Czas ladowania musi byc pozniejszy niz czas startu.',
        variant: 'destructive',
      });
      return;
    }
    if (form.actualStart && form.actualEnd && new Date(form.actualEnd) <= new Date(form.actualStart)) {
      toast({
        title: 'Nieprawidlowe daty rzeczywiste',
        description: 'Rzeczywisty czas ladowania musi byc pozniejszy niz rzeczywisty czas startu.',
        variant: 'destructive',
      });
      return;
    }
    if (!editing && form.operationIds.length === 0) {
      toast({ title: 'Wybierz co najmniej jedną operację', variant: 'destructive' });
      return;
    }
    if (editing) updateMut.mutate({ id: editing.id, ...form });
    else {
      const payload = {
        ...form,
        operationIds: [...form.operationIds],
      };
      createMut.mutate(payload);
    }
  };

  const handleInlineStatusChange = (order: FlightOrder, nextStatus: FlightOrderStatus) => {
    if (order.status === nextStatus) return;
    if ((nextStatus === 5 || nextStatus === 6) && (!order.actualStart || !order.actualEnd)) {
      toast({
        title: 'Uzupelnij daty rzeczywiste',
        description: 'Status 5/6 wymaga daty i godziny rzeczywistego startu oraz ladowania.',
        variant: 'destructive',
      });
      return;
    }
    updateMut.mutate({ id: order.id, status: nextStatus });
  };

  // Map data for detail view
  const viewingMarkers: MapMarker[] = useMemo(() => {
    if (!viewing) return [];
    const siteMarkers = [viewing.startSiteId, viewing.endSiteId]
      .map(id => sites.find(s => s.id === id))
      .filter(Boolean)
      .map(s => ({ id: `site-${s!.id}`, lat: s!.latitude, lng: s!.longitude, popup: s!.name, markerType: 'site' as const }));
    const orderedViewingOperations = viewingPreviewRoute?.orderedOperations ?? [];
    const routeVisuals = orderedViewingOperations.length > 0
      ? buildFlightPreviewRouteVisualsFromOrderedOperations(
          viewing.startSiteId,
          viewing.endSiteId,
          orderedViewingOperations,
          sites,
          operations
        )
      : buildFlightPreviewRouteVisuals(
          viewing.startSiteId,
          viewing.endSiteId,
          viewing.operationIds,
          sites,
          operations
        );
    const operationMarkers = routeVisuals?.operationMarkers ?? [];
    return [...siteMarkers, ...operationMarkers];
  }, [viewing, sites, operations, viewingPreviewRoute]);

  const viewingPolylines: MapPolyline[] = useMemo(() => {
    if (!viewing) return [];
    const orderedViewingOperations = viewingPreviewRoute?.orderedOperations ?? [];
    const routeVisuals = orderedViewingOperations.length > 0
      ? buildFlightPreviewRouteVisualsFromOrderedOperations(
          viewing.startSiteId,
          viewing.endSiteId,
          orderedViewingOperations,
          sites,
          operations
        )
      : buildFlightPreviewRouteVisuals(
          viewing.startSiteId,
          viewing.endSiteId,
          viewing.operationIds,
          sites,
          operations
        );
    if (routeVisuals) {
      return [
        ...routeVisuals.transitPolylines
          .filter((positions) => positions.length >= 2)
          .map((positions) => ({ positions, color: '#1e293b', weight: 3 })),
        ...routeVisuals.operationPolylines
          .filter((positions) => positions.length >= 2)
          .map((positions) => ({ positions, color: '#f97316', weight: 5 })),
      ];
    }
    const positions = buildFlightOrderPolylinePositions(viewing, sites, operations);
    if (!positions || positions.length < 2) return [];
    return [{ positions }];
  }, [viewing, sites, operations, viewingPreviewRoute]);

  const viewingCenter: [number, number] = viewingMarkers.length > 0
    ? [viewingMarkers[0].lat, viewingMarkers[0].lng]
    : [50.06, 19.94];

  if (isLoading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Zlecenia na lot</h1>
        {(user?.role === 'PILOT' || user?.role === 'ADMIN') && (
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Dodaj</Button>
        )}
      </div>

      <div className="flex gap-2 items-center">
        <span className="text-sm text-muted-foreground">Status:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 justify-start [&>svg]:ml-auto">
            <span className="truncate text-left">
              {statusFilter === 'all'
                ? 'Wszystkie'
                : statusFilter === 'pending'
                  ? 'Oczekujace'
                  : statusFilter === 'completed'
                    ? 'Zakonczone'
                : flightOrderStatusLabels[Number(statusFilter) as FlightOrderStatus]}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie</SelectItem>
            <SelectItem value="pending">Oczekujace (1 i 2)</SelectItem>
            <SelectItem value="completed">Zakonczone (5 i 6)</SelectItem>
            {([1, 2, 3, 4, 5, 6, 7] as FlightOrderStatus[]).map(s => (
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
              <TableHead>Planowany start</TableHead>
              <TableHead>Planowane ladowanie</TableHead>
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
                <TableCell className="text-sm">{new Date(o.plannedStart).toLocaleString('pl-PL')}</TableCell>
                <TableCell className="text-sm">{new Date(o.plannedEnd).toLocaleString('pl-PL')}</TableCell>
                <TableCell>{getHelicopterName(o.helicopterId)}</TableCell>
                <TableCell>{getPilotName(o.pilotId)}</TableCell>
                <TableCell>
                  {(() => {
                    const statusOptions = getAllowedStatusOptions(o.status, user?.role);
                    return (
                  <Select
                    value={String(o.status)}
                    onValueChange={v => handleInlineStatusChange(o, Number(v) as FlightOrderStatus)}
                  >
                    <SelectTrigger className="w-40 h-8 justify-start text-xs [&>svg]:ml-auto" disabled={statusOptions.length <= 1}>
                      <span className="truncate text-left">{flightOrderStatusLabels[o.status]}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(s => (
                        <SelectItem key={s} value={String(s)}>{flightOrderStatusLabels[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                    );
                  })()}
                </TableCell>
                <TableCell className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setViewing(o); setDetailOpen(true); }}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(o)}><Pencil className="h-4 w-4" /></Button>
                  {user?.role === 'ADMIN' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPendingDeleteOrder(o)}
                      disabled={deleteMut.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edytuj zlecenie na lot' : 'Nowe zlecenie na lot'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Daty planowane</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Data i godzina planowanego startu</label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={getDatePart(form.plannedStart)}
                    onChange={e => setForm(f => ({ ...f, plannedStart: mergeDateTimeParts(f.plannedStart, { date: e.target.value }) }))}
                    required
                  />
                  <Input
                    type="time"
                    step={300}
                    value={getTimePart(form.plannedStart)}
                    onChange={e => setForm(f => ({ ...f, plannedStart: mergeDateTimeParts(f.plannedStart, { time: e.target.value }) }))}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">Wymagane.</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Data i godzina planowanego ladowania</label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={getDatePart(form.plannedEnd)}
                    min={getDatePart(form.plannedStart) || undefined}
                    onChange={e => setForm(f => ({ ...f, plannedEnd: mergeDateTimeParts(f.plannedEnd, { date: e.target.value }) }))}
                    required
                  />
                  <Input
                    type="time"
                    step={300}
                    value={getTimePart(form.plannedEnd)}
                    min={getDatePart(form.plannedEnd) && getDatePart(form.plannedEnd) === getDatePart(form.plannedStart) ? getTimePart(form.plannedStart) || undefined : undefined}
                    onChange={e => setForm(f => ({ ...f, plannedEnd: mergeDateTimeParts(f.plannedEnd, { time: e.target.value }) }))}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">Wymagane.</p>
              </div>
            </div>
            {editing && (
              <>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Daty rzeczywiste</h3>
                  <p className="text-xs text-muted-foreground">Wypelnij pare dat przy rozliczaniu lotu.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">Data i godzina rzeczywistego startu</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={getDatePart(form.actualStart)}
                        onChange={e => setForm(f => ({ ...f, actualStart: mergeDateTimeParts(f.actualStart, { date: e.target.value }) }))}
                      />
                      <Input
                        type="time"
                        step={300}
                        value={getTimePart(form.actualStart)}
                        onChange={e => setForm(f => ({ ...f, actualStart: mergeDateTimeParts(f.actualStart, { time: e.target.value }) }))}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Wymagane przed ustawieniem statusu 5 lub 6.</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">Data i godzina rzeczywistego ladowania</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={getDatePart(form.actualEnd)}
                        min={getDatePart(form.actualStart) || undefined}
                        onChange={e => setForm(f => ({ ...f, actualEnd: mergeDateTimeParts(f.actualEnd, { date: e.target.value }) }))}
                      />
                      <Input
                        type="time"
                        step={300}
                        value={getTimePart(form.actualEnd)}
                        min={getDatePart(form.actualEnd) && getDatePart(form.actualEnd) === getDatePart(form.actualStart) ? getTimePart(form.actualStart) || undefined : undefined}
                        onChange={e => setForm(f => ({ ...f, actualEnd: mergeDateTimeParts(f.actualEnd, { time: e.target.value }) }))}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Wymagane przed ustawieniem statusu 5 lub 6.</p>
                  </div>
                </div>
              </>
            )}

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
              <p className="mt-1 text-xs text-muted-foreground">Dostepne sa tylko helikoptery ze statusem aktywny.</p>
            </div>

            {(editing || user?.role === 'ADMIN') && (
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
                <p className="mt-1 text-xs text-muted-foreground">Pilot musi miec role PILOT w slowniku zalogi.</p>
              </div>
            )}
            {!editing && user?.role !== 'ADMIN' && (
              <p className="text-xs text-muted-foreground">Pilot jest uzupełniany automatycznie na podstawie zalogowanego użytkownika.</p>
            )}

            <div>
              <label className="text-sm font-medium text-foreground">Załoga</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {crew.filter(c => c.id !== effectivePilotId).map(c => (
                  <Badge key={c.id} className={`cursor-pointer ${form.crewIds.includes(c.id) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`} onClick={() => toggleMulti('crewIds', c.id)}>
                    {c.name} ({c.weight}kg)
                  </Badge>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Opcjonalne. Waga zalogi liczona jest automatycznie (pilot + wybrane osoby).</p>
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
                <p className="mt-1 text-xs text-muted-foreground">Wymagane.</p>
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
                <p className="mt-1 text-xs text-muted-foreground">Wymagane.</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Operacje</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {operations
                  .filter(o => o.status === 3 || form.operationIds.includes(o.id))
                  .sort((a, b) => (a.plannedDateFrom || '9999-99-99').localeCompare(b.plannedDateFrom || '9999-99-99'))
                  .map(o => (
                  <Badge key={o.id} className={`cursor-pointer ${form.operationIds.includes(o.id) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`} onClick={() => toggleMulti('operationIds', o.id)}>
                    {o.projectCode}
                  </Badge>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Wymagane. Widoczne są operacje o statusie "Potwierdzone do planu", posortowane po planowanej dacie.</p>
            </div>

            <div className="p-3 rounded-md bg-muted space-y-1 text-sm">
              <p><span className="text-muted-foreground">Waga załogi:</span> <strong>{crewWeight} kg</strong></p>
              <p>
                <span className="text-muted-foreground">Obciążenie:</span>{' '}
                {helicopter
                  ? `${crewWeight} / ${helicopter.maxWeight} kg (${Math.round((crewWeight / helicopter.maxWeight) * 100)}%)`
                  : `${crewWeight} / - kg`}
              </p>
              {helicopter && <p><span className="text-muted-foreground">Maks. zasięg:</span> {helicopter.maxRange} km</p>}
              {!editing && (
                <p>
                  <span className="text-muted-foreground">Szacowany dystans:</span>{' '}
                  {canPreviewRoute
                    ? isPreviewRouteLoading
                      ? 'Obliczanie...'
                      : isPreviewRouteError
                        ? 'Nie udało się obliczyć'
                        : `${previewRoute?.totalDistanceKm ?? 0} km`
                    : 'Wybierz start, cel i helikopter'}
                </p>
              )}
              {!editing && canPreviewRoute && previewRoute && (
                <p>
                  <span className="text-muted-foreground">Status zasięgu:</span>{' '}
                  {previewRoute.withinHelicopterRange
                    ? `OK (zapas ${previewRoute.rangeMarginKm.toFixed(2)} km)`
                    : `Przekroczony o ${Math.abs(previewRoute.rangeMarginKm).toFixed(2)} km`}
                </p>
              )}
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

            {!editing && isRangeExceeded && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4" />
                Wybrany zestaw operacji przekracza zasięg helikoptera o {Math.abs(previewRoute!.rangeMarginKm).toFixed(2)} km.
              </div>
            )}

            {!editing && formPreviewMarkers.length > 0 && (
              <LeafletMap
                center={previewCenter}
                zoom={8}
                markers={formPreviewMarkers}
                polylines={formPreviewPolylines}
                autoFitBounds
                className="h-[320px]"
              />
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={
                (!editing && (isRangeExceeded || (canPreviewRoute && isPreviewRouteError))) ||
                (!editing && user?.role === 'ADMIN' && !form.pilotId)
              }
            >
              {editing ? 'Zapisz' : 'Dodaj'}
            </Button>
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
                <div><span className="text-muted-foreground">Planowany start:</span> {new Date(viewing.plannedStart).toLocaleString('pl-PL')}</div>
                <div><span className="text-muted-foreground">Planowane ladowanie:</span> {new Date(viewing.plannedEnd).toLocaleString('pl-PL')}</div>
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

      <AlertDialog
        open={Boolean(pendingDeleteOrder)}
        onOpenChange={(openValue) => {
          if (!openValue) setPendingDeleteOrder(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potwierdz usuniecie zlecenia</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunac zlecenie nr {pendingDeleteOrder?.id}? Tej operacji nie mozna cofnac.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingDeleteOrder) return;
                deleteMut.mutate(pendingDeleteOrder.id);
                setPendingDeleteOrder(null);
              }}
            >
              Usun
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FlightOrdersPage;
