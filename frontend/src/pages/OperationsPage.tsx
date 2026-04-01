import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchOperations, createOperationFromKml, updateOperation } from '@/api/api';
import type { PlannedOperation, OperationStatus } from '@/types';
import { operationStatusLabels } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Pencil, Eye, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import LeafletMap from '@/components/LeafletMap';
import type { MapMarker, MapPolyline } from '@/components/LeafletMap';

const statusColors: Record<OperationStatus, string> = {
  1: 'bg-slate-100 text-slate-800',
  2: 'bg-red-100 text-red-800',
  3: 'bg-emerald-100 text-emerald-800',
  4: 'bg-amber-100 text-amber-800',
  5: 'bg-violet-100 text-violet-800',
  6: 'bg-green-100 text-green-800',
  7: 'bg-zinc-200 text-zinc-800',
};

const allStatuses: OperationStatus[] = [1, 2, 3, 4, 5, 6, 7];
const plannerEditableStatuses: OperationStatus[] = [1, 2, 3, 4, 5];
const plannerResignationStatuses: OperationStatus[] = [1, 3, 4];

const activityOptions = [
  { value: 'ogledziny_wizualne', label: 'Oględziny wizualne' },
  { value: 'skan_3d', label: 'Skan 3D' },
  { value: 'lokalizacja_awarii', label: 'Lokalizacja awarii' },
  { value: 'zdjecia', label: 'Zdjęcia' },
  { value: 'patrolowanie', label: 'Patrolowanie' },
] as const;
type ActivityValue = (typeof activityOptions)[number]['value'];
const activityLabelByValue: Record<ActivityValue, string> = activityOptions.reduce(
  (acc, option) => ({ ...acc, [option.value]: option.label }),
  {} as Record<ActivityValue, string>
);
const activityValueAliases: Record<string, ActivityValue> = {
  ogledziny_wizualne: 'ogledziny_wizualne',
  'oględziny wizualne': 'ogledziny_wizualne',
  'ogledziny wizualne': 'ogledziny_wizualne',
  skan_3d: 'skan_3d',
  'skan 3d': 'skan_3d',
  lokalizacja_awarii: 'lokalizacja_awarii',
  'lokalizacja awarii': 'lokalizacja_awarii',
  zdjecia: 'zdjecia',
  zdjęcia: 'zdjecia',
  patrolowanie: 'patrolowanie',
  survey: 'ogledziny_wizualne',
};

const normalizeActivityValue = (value: string): ActivityValue | null => {
  const normalized = value.trim().toLowerCase();
  return activityValueAliases[normalized] ?? null;
};

const normalizeRawActivity = (value: string): string => value.trim().toLowerCase();

const toActivityLabel = (value: string): string => {
  const known = normalizeActivityValue(value);
  if (known) return activityLabelByValue[known];
  const cleaned = value.trim();
  if (!cleaned) return '-';
  return cleaned
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^./, (char) => char.toUpperCase());
};

const toHistoryActionLabel = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'update') return 'Modyfikacja';
  if (normalized === 'create') return 'Wprowadzenie';
  if (normalized === 'status_change') return 'Zmiana statusu';
  return value;
};

const parseStatusFromSnapshot = (snapshot: Record<string, unknown> | null | undefined): OperationStatus | null => {
  const rawStatus = snapshot?.status;
  const numericStatus = typeof rawStatus === 'number'
    ? rawStatus
    : typeof rawStatus === 'string'
      ? Number(rawStatus)
      : NaN;
  if (!Number.isInteger(numericStatus) || numericStatus < 1 || numericStatus > 7) return null;
  return numericStatus as OperationStatus;
};

const toHistoryStatusChangeLabel = (entry: PlannedOperation['history'][number]): string | null => {
  if (entry.action.trim().toLowerCase() !== 'status_change') return null;
  const fromStatus = parseStatusFromSnapshot(entry.beforeSnapshot);
  const toStatus = parseStatusFromSnapshot(entry.afterSnapshot);
  if (!fromStatus || !toStatus) return null;
  return `${operationStatusLabels[fromStatus]} -> ${operationStatusLabels[toStatus]}`;
};

type OperationForm = {
  projectCode: string;
  shortDescription: string;
  proposedDateFrom: string;
  proposedDateTo: string;
  plannedDateFrom: string;
  plannedDateTo: string;
  activities: string[];
  extraInfo: string;
  contactsRaw: string;
  postRealizationNotes: string;
  comment: string;
};

type SortableColumn = 'id' | 'projectCode' | 'proposedDateFrom' | 'proposedDateTo' | 'plannedDateFrom' | 'plannedDateTo';
type SortDirection = 'asc' | 'desc';

const emptyForm: OperationForm = {
  projectCode: '',
  shortDescription: '',
  proposedDateFrom: '',
  proposedDateTo: '',
  plannedDateFrom: '',
  plannedDateTo: '',
  activities: [],
  extraInfo: '',
  contactsRaw: '',
  postRealizationNotes: '',
  comment: '',
};

const OperationsPage: React.FC = () => {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { data: operations = [], isLoading } = useQuery({ queryKey: ['operations'], queryFn: fetchOperations });
  const [statusFilter, setStatusFilter] = useState<string>('3');
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [sortColumn, setSortColumn] = useState<SortableColumn>('plannedDateFrom');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<PlannedOperation | null>(null);
  const [viewing, setViewing] = useState<PlannedOperation | null>(null);
  const [kmlFile, setKmlFile] = useState<File | null>(null);
  const [form, setForm] = useState<OperationForm>(emptyForm);
  const [pendingStatusAction, setPendingStatusAction] = useState<{
    operationId: string;
    status: OperationStatus;
    title: string;
    description: string;
  } | null>(null);

  const isPlanner = user?.role === 'PLANNER';
  const isSupervisor = user?.role === 'SUPERVISOR' || user?.role === 'ADMIN';
  const isPilot = user?.role === 'PILOT';

  const createMut = useMutation({
    mutationFn: ({ file }: { file: File }) => {
      const payload = {
        projectCode: form.projectCode,
        shortDescription: form.shortDescription,
        proposedDateFrom: form.proposedDateFrom || undefined,
        proposedDateTo: form.proposedDateTo || undefined,
        activities: form.activities,
        extraInfo: form.extraInfo || undefined,
        contacts: form.contactsRaw
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        ...(!isPlanner
          ? {
              plannedDateFrom: form.plannedDateFrom || undefined,
              plannedDateTo: form.plannedDateTo || undefined,
            }
          : {}),
      };
      return createOperationFromKml(payload, file);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operations'] });
      setOpen(false);
      toast({ title: 'Dodano operacje' });
    },
    onError: (error: Error) => {
      toast({ title: 'Nie udalo sie dodac operacji', description: error.message, variant: 'destructive' });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: { id: string; [key: string]: unknown }) => updateOperation(id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operations'] });
      setOpen(false);
      setDetailOpen(false);
      toast({ title: 'Zaktualizowano operacje' });
    },
    onError: (error: Error) => {
      toast({ title: 'Nie udalo sie zaktualizowac operacji', description: error.message, variant: 'destructive' });
    },
  });

  const onSortChange = (column: SortableColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortColumn(column);
    setSortDirection('asc');
  };

  const renderSortIcon = (column: SortableColumn) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3.5 w-3.5" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
  };

  const filtered = useMemo(() => {
    const byStatus =
      statusFilter === 'all' ? operations : operations.filter((operation) => operation.status === Number(statusFilter));
    const byActivity =
      activityFilter === 'all'
        ? byStatus
        : byStatus.filter((operation) =>
            operation.activities.some((activity) => {
              const normalized = normalizeActivityValue(activity);
              return normalized ? normalized === activityFilter : normalizeRawActivity(activity) === activityFilter;
            })
          );

    return [...byActivity].sort((a, b) => {
      const aValue = (a[sortColumn] ?? '').toString().trim();
      const bValue = (b[sortColumn] ?? '').toString().trim();

      if (!aValue && bValue) return sortDirection === 'asc' ? 1 : -1;
      if (aValue && !bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue && bValue) {
        const compareResult = aValue.localeCompare(bValue, 'pl', { numeric: true, sensitivity: 'base' });
        if (compareResult !== 0) return sortDirection === 'asc' ? compareResult : -compareResult;
      }
      return a.id.localeCompare(b.id);
    });
  }, [activityFilter, operations, sortColumn, sortDirection, statusFilter]);
  const viewingRoutePoints: [number, number][] = useMemo(() => {
    if (!viewing?.routeGeometry?.coordinates?.length) return [];
    return viewing.routeGeometry.coordinates
      .filter(
        (pair): pair is [number, number] =>
          Array.isArray(pair) &&
          pair.length === 2 &&
          Number.isFinite(pair[0]) &&
          Number.isFinite(pair[1])
      )
      .map(([longitude, latitude]) => [latitude, longitude]);
  }, [viewing]);
  const viewingRouteMarkers: MapMarker[] = useMemo(() => {
    if (viewingRoutePoints.length === 0) return [];
    const [startLat, startLng] = viewingRoutePoints[0];
    const [endLat, endLng] = viewingRoutePoints[viewingRoutePoints.length - 1];
    return [
      { id: 'start', lat: startLat, lng: startLng, popup: 'Start trasy', markerType: 'site' },
      { id: 'end', lat: endLat, lng: endLng, popup: 'Koniec trasy', markerType: 'site' },
    ];
  }, [viewingRoutePoints]);
  const viewingRoutePolylines: MapPolyline[] = useMemo(() => {
    if (viewingRoutePoints.length < 2) return [];
    return [{ positions: viewingRoutePoints, color: '#0f766e', weight: 4 }];
  }, [viewingRoutePoints]);
  const viewingRouteCenter: [number, number] = viewingRoutePoints.length > 0
    ? viewingRoutePoints[0]
    : [52.0, 19.0];
  const hasProjectCode = form.projectCode.trim().length > 0;
  const hasShortDescription = form.shortDescription.trim().length > 0;

  const contacts = useMemo(
    () =>
      form.contactsRaw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [form.contactsRaw]
  );
  const invalidContacts = useMemo(
    () => contacts.filter((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
    [contacts]
  );
  const hasProposedDateRangeError =
    Boolean(form.proposedDateFrom) && Boolean(form.proposedDateTo) && form.proposedDateFrom > form.proposedDateTo;
  const hasPlannedDateRangeError =
    Boolean(form.plannedDateFrom) && Boolean(form.plannedDateTo) && form.plannedDateFrom > form.plannedDateTo;
  const submitBlockReason = (() => {
    if (!hasProjectCode) return 'Uzupelnij numer zlecenia/projektu.';
    if (!hasShortDescription) return 'Uzupelnij opis skrocony.';
    if (form.activities.length < 1) return 'Wybierz co najmniej jedna czynnosc.';
    if (invalidContacts.length > 0) return 'Popraw format adresow e-mail.';
    if (hasProposedDateRangeError) return 'Proponowana data od nie moze byc pozniej niz do.';
    if (hasPlannedDateRangeError) return 'Planowana data od nie moze byc pozniej niz do.';
    if (!editing && !kmlFile) return 'Wybierz plik KML.';
    return null;
  })();

  const canEditOperation = (operation: PlannedOperation): boolean => {
    if (isSupervisor) return true;
    if (isPlanner) return plannerEditableStatuses.includes(operation.status);
    return false;
  };

  const openCreate = () => {
    setEditing(null);
    setKmlFile(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (operation: PlannedOperation) => {
    setEditing(operation);
    setKmlFile(null);
    setForm({
      projectCode: operation.projectCode,
      shortDescription: operation.shortDescription,
      proposedDateFrom: operation.proposedDateFrom,
      proposedDateTo: operation.proposedDateTo,
      plannedDateFrom: operation.plannedDateFrom,
      plannedDateTo: operation.plannedDateTo,
      activities: operation.activities
        .map((item) => normalizeRawActivity(item))
        .filter((item) => item.length > 0),
      extraInfo: operation.extraInfo,
      contactsRaw: operation.contacts.join(', '),
      postRealizationNotes: operation.postRealizationNotes,
      comment: '',
    });
    setOpen(true);
  };

  const toggleActivity = (activity: ActivityValue) => {
    const normalized = normalizeRawActivity(activity);
    setForm((prev) => ({
      ...prev,
      activities: prev.activities.includes(normalized)
        ? prev.activities.filter((item) => item !== normalized)
        : [...prev.activities, normalized],
    }));
  };

  const handleFormDialogChange = (openValue: boolean) => {
    setOpen(openValue);
    if (!openValue) {
      setEditing(null);
      setKmlFile(null);
      setForm(emptyForm);
    }
  };

  const handleDetailDialogChange = (openValue: boolean) => {
    setDetailOpen(openValue);
    if (!openValue) setViewing(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitBlockReason) {
      toast({ title: submitBlockReason, variant: 'destructive' });
      return;
    }
    if (editing) {
      const payload: Record<string, unknown> = {
        projectCode: form.projectCode,
        shortDescription: form.shortDescription,
        proposedDateFrom: form.proposedDateFrom,
        proposedDateTo: form.proposedDateTo,
        activities: form.activities,
        extraInfo: form.extraInfo,
        contacts,
      };
      if (!isPlanner) {
        payload.plannedDateFrom = form.plannedDateFrom;
        payload.plannedDateTo = form.plannedDateTo;
        payload.postRealizationNotes = form.postRealizationNotes;
      }
      if (form.comment.trim().length > 0) payload.comment = form.comment;
      updateMut.mutate({ id: editing.id, ...payload });
      return;
    }
    createMut.mutate({ file: kmlFile as File });
  };

  const updateStatus = (operationId: string, status: OperationStatus) => {
    updateMut.mutate({ id: operationId, status });
  };

  const requestStatusChange = (operationId: string, status: OperationStatus) => {
    const requiresConfirmation = [2, 5, 6, 7].includes(status);
    if (!requiresConfirmation) {
      updateStatus(operationId, status);
      return;
    }
    const statusLabel = operationStatusLabels[status];
    setPendingStatusAction({
      operationId,
      status,
      title: `Potwierdz zmiane statusu na "${statusLabel}"`,
      description: 'Ta operacja moze byc trudna do odwrocenia. Czy na pewno chcesz kontynuowac?',
    });
  };

  if (isLoading) return <div className="flex justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Lista operacji</h1>
        {(isPlanner || isSupervisor) && (
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Dodaj</Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Status:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie</SelectItem>
            {allStatuses.map((statusValue) => (
              <SelectItem key={statusValue} value={String(statusValue)}>{operationStatusLabels[statusValue]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-2 text-sm text-muted-foreground">Rodzaj czynności:</span>
        <Select value={activityFilter} onValueChange={setActivityFilter}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie</SelectItem>
            {activityOptions.map((activity) => (
              <SelectItem key={activity.value} value={activity.value}>{activity.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button type="button" variant="ghost" className="h-auto gap-1 px-0 font-semibold" onClick={() => onSortChange('id')}>
                  Nr operacji
                  {renderSortIcon('id')}
                </Button>
              </TableHead>
              <TableHead>
                <Button type="button" variant="ghost" className="h-auto gap-1 px-0 font-semibold" onClick={() => onSortChange('projectCode')}>
                  Nr zlecenia
                  {renderSortIcon('projectCode')}
                </Button>
              </TableHead>
              <TableHead>Rodzaj czynności</TableHead>
              <TableHead>
                <Button type="button" variant="ghost" className="h-auto gap-1 px-0 text-left font-semibold" onClick={() => onSortChange('proposedDateFrom')}>
                  Proponowane: najwcześniej
                  {renderSortIcon('proposedDateFrom')}
                </Button>
              </TableHead>
              <TableHead>
                <Button type="button" variant="ghost" className="h-auto gap-1 px-0 text-left font-semibold" onClick={() => onSortChange('proposedDateTo')}>
                  Proponowane: najpóźniej
                  {renderSortIcon('proposedDateTo')}
                </Button>
              </TableHead>
              <TableHead>
                <Button type="button" variant="ghost" className="h-auto gap-1 px-0 text-left font-semibold" onClick={() => onSortChange('plannedDateFrom')}>
                  Planowane: najwcześniej
                  {renderSortIcon('plannedDateFrom')}
                </Button>
              </TableHead>
              <TableHead>
                <Button type="button" variant="ghost" className="h-auto gap-1 px-0 text-left font-semibold" onClick={() => onSortChange('plannedDateTo')}>
                  Planowane: najpóźniej
                  {renderSortIcon('plannedDateTo')}
                </Button>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((operation) => (
              <TableRow key={operation.id}>
                <TableCell>{operation.id}</TableCell>
                <TableCell className="font-medium">{operation.projectCode}</TableCell>
                <TableCell>{operation.activities.map((value) => toActivityLabel(value)).join(', ') || '-'}</TableCell>
                <TableCell>{operation.proposedDateFrom || '-'}</TableCell>
                <TableCell>{operation.proposedDateTo || '-'}</TableCell>
                <TableCell>{operation.plannedDateFrom || '-'}</TableCell>
                <TableCell>{operation.plannedDateTo || '-'}</TableCell>
                <TableCell><Badge className={statusColors[operation.status]}>{operationStatusLabels[operation.status]}</Badge></TableCell>
                <TableCell className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setViewing(operation); setDetailOpen(true); }}><Eye className="h-4 w-4" /></Button>
                  {canEditOperation(operation) && (
                    <Button variant="ghost" size="icon" onClick={() => openEdit(operation)}><Pencil className="h-4 w-4" /></Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                  Brak operacji dla wybranego filtra.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={handleFormDialogChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edytuj operację lotniczą' : 'Utwórz operację lotniczą'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="project-code" className="text-sm font-medium text-foreground">Nr zlecenia/projektu</label>
              <Input id="project-code" maxLength={30} placeholder="Nr zlecenia/projektu" value={form.projectCode} onChange={(e) => setForm((f) => ({ ...f, projectCode: e.target.value }))} required />
            </div>
            <p className="text-right text-xs text-muted-foreground">{form.projectCode.length}/30</p>
            <div className="space-y-1">
              <label htmlFor="short-description" className="text-sm font-medium text-foreground">Opis skrócony</label>
              <Textarea id="short-description" maxLength={100} placeholder="Opis skrocony" value={form.shortDescription} onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))} required />
            </div>
            <p className="text-right text-xs text-muted-foreground">{form.shortDescription.length}/100</p>

            <div>
              <label className="text-sm font-medium text-foreground">Rodzaj czynności (min. 1)</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {activityOptions.map((option) => (
                  <Badge
                    key={option.value}
                    className={`cursor-pointer ${form.activities.includes(option.value) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                    onClick={() => toggleActivity(option.value)}
                  >
                    {option.label}
                  </Badge>
                ))}
              </div>
              {form.activities.length === 0 && (
                <p className="mt-1 text-xs text-destructive">Wymagany wybor przynajmniej jednej czynności.</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Proponowane daty</label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                      <label htmlFor="proposed-date-from" className="text-xs text-foreground">Najwcześniej</label>
                  <Input id="proposed-date-from" aria-label="Proponowana data najwcześniej" type="date" value={form.proposedDateFrom} onChange={(e) => setForm((f) => ({ ...f, proposedDateFrom: e.target.value }))} />
                </div>
                <div className="space-y-1">
                      <label htmlFor="proposed-date-to" className="text-xs text-foreground">Najpóźniej</label>
                  <Input id="proposed-date-to" aria-label="Proponowana data najpóźniej" type="date" value={form.proposedDateTo} onChange={(e) => setForm((f) => ({ ...f, proposedDateTo: e.target.value }))} />
                </div>
              </div>
            </div>
            {hasProposedDateRangeError && (
              <p className="text-xs text-destructive">Proponowana data od nie moze byc pozniej niz data do.</p>
            )}
            {!isPlanner && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Planowane daty</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                  <label htmlFor="planned-date-from" className="text-xs text-foreground">Najwcześniej</label>
                      <Input
                        id="planned-date-from"
                        aria-label="Planowana data najwcześniej"
                        type="date"
                        value={form.plannedDateFrom}
                        onChange={(e) => setForm((f) => ({ ...f, plannedDateFrom: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                  <label htmlFor="planned-date-to" className="text-xs text-foreground">Najpóźniej</label>
                      <Input
                        id="planned-date-to"
                        aria-label="Planowana data najpóźniej"
                        type="date"
                        value={form.plannedDateTo}
                        onChange={(e) => setForm((f) => ({ ...f, plannedDateTo: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
                {hasPlannedDateRangeError && (
                  <p className="text-xs text-destructive">Planowana data od nie moze byc pozniej niz data do.</p>
                )}
              </>
            )}
            {isPlanner && (
              <p className="text-xs text-muted-foreground">
                Pola planowanych dat, statusu i uwag po realizacji sa ukryte dla planisty.
              </p>
            )}
            <div className="space-y-1">
              <label htmlFor="extra-info" className="text-sm font-medium text-foreground">Dodatkowe informacje</label>
              <Textarea id="extra-info" maxLength={500} placeholder="Dodatkowe informacje" value={form.extraInfo} onChange={(e) => setForm((f) => ({ ...f, extraInfo: e.target.value }))} />
            </div>
            <p className="text-right text-xs text-muted-foreground">{form.extraInfo.length}/500</p>
            <div className="space-y-1">
              <label htmlFor="contacts" className="text-sm font-medium text-foreground">Osoby kontaktowe (emaile po przecinku)</label>
              <Input id="contacts" placeholder="Osoby kontaktowe (emaile po przecinku)" value={form.contactsRaw} onChange={(e) => setForm((f) => ({ ...f, contactsRaw: e.target.value }))} />
            </div>
            {invalidContacts.length > 0 && (
              <p className="text-xs text-destructive">Niepoprawne adresy: {invalidContacts.join(', ')}</p>
            )}
            {!isPlanner && (
              <>
                <div className="space-y-1">
                  <label htmlFor="post-realization-notes" className="text-sm font-medium text-foreground">Uwagi po realizacji</label>
                  <Textarea
                    id="post-realization-notes"
                    maxLength={500}
                    placeholder="Uwagi po realizacji"
                    value={form.postRealizationNotes}
                    onChange={(e) => setForm((f) => ({ ...f, postRealizationNotes: e.target.value }))}
                  />
                </div>
                <p className="text-right text-xs text-muted-foreground">{form.postRealizationNotes.length}/500</p>
              </>
            )}
            {editing && (
              <>
                <div className="space-y-1">
                  <label htmlFor="operation-comment" className="text-sm font-medium text-foreground">Komentarz (nowy wpis)</label>
                  <Textarea
                    id="operation-comment"
                    maxLength={500}
                    placeholder="Komentarz (nowy wpis)"
                    value={form.comment}
                    onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                  />
                </div>
                <p className="text-right text-xs text-muted-foreground">{form.comment.length}/500</p>
              </>
            )}
            {!editing && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Plik trasy KML (wymagany)</label>
                <Input type="file" accept=".kml,application/vnd.google-earth.kml+xml" onChange={(e) => setKmlFile(e.target.files?.[0] ?? null)} required />
                {kmlFile && <p className="text-xs text-muted-foreground">Wybrano: {kmlFile.name}</p>}
              </div>
            )}
            {submitBlockReason && (
              <p className="text-xs text-destructive">{submitBlockReason}</p>
            )}
            <Button type="submit" className="w-full" disabled={Boolean(submitBlockReason) || createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? 'Zapisywanie...' : editing ? 'Zapisz' : 'Dodaj'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={handleDetailDialogChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Operacja {viewing?.projectCode}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="space-y-2 rounded-md border p-3">
                <h3 className="text-sm font-semibold">Szczegóły operacji</h3>
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <div className="space-y-1">
                    <div><span className="text-muted-foreground">Opis:</span> {viewing.shortDescription}</div>
                    <div><span className="text-muted-foreground">Czynności:</span> {viewing.activities.map((value) => toActivityLabel(value)).join(', ') || '-'}</div>
                    <div><span className="text-muted-foreground">Status:</span> <Badge className={statusColors[viewing.status]}>{operationStatusLabels[viewing.status]}</Badge></div>
                  </div>
                  <div className="space-y-1">
                    <div><span className="text-muted-foreground">Proponowane daty:</span> {viewing.proposedDateFrom || '-'} - {viewing.proposedDateTo || '-'}</div>
                    <div><span className="text-muted-foreground">Planowane daty:</span> {viewing.plannedDateFrom || '-'} - {viewing.plannedDateTo || '-'}</div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1 rounded-md border p-3 text-sm">
                  <h3 className="text-sm font-semibold">Trasa</h3>
                  <div><span className="text-muted-foreground">Liczba punktów:</span> {viewing.pointsCount}</div>
                  <div><span className="text-muted-foreground">Długość (km):</span> {viewing.distanceKm}</div>
                </div>
                <div className="space-y-1 rounded-md border p-3">
                  <h3 className="text-sm font-semibold">Osoby kontaktowe</h3>
                  {viewing.contacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">-</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {viewing.contacts.map((contact) => (
                        <li key={contact}>{contact}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="space-y-2 rounded-md border p-3">
                <h3 className="text-sm font-semibold">Mapa trasy z KML</h3>
                {viewingRoutePolylines.length > 0 ? (
                  <LeafletMap
                    center={viewingRouteCenter}
                    zoom={8}
                    markers={viewingRouteMarkers}
                    polylines={viewingRoutePolylines}
                    autoFitBounds
                    className="h-[320px]"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Brak danych trasy do wyświetlenia na mapie.</p>
                )}
              </div>

              <div className="space-y-2 rounded-md border p-3">
                <h3 className="text-sm font-semibold">Powiązane zlecenia</h3>
                {viewing.linkedFlightOrderIds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">-</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {viewing.linkedFlightOrderIds.map((orderId) => (
                      <Badge key={orderId} variant="secondary">{orderId}</Badge>
                    ))}
                  </div>
                )}
              </div>

              {(isSupervisor && viewing.status === 1) && (
                <div className="space-y-1">
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" onClick={() => requestStatusChange(viewing.id, 2)} disabled={updateMut.isPending}>Odrzuc</Button>
                    <Button
                      size="sm"
                      onClick={() => requestStatusChange(viewing.id, 3)}
                      disabled={!viewing.plannedDateFrom || !viewing.plannedDateTo || updateMut.isPending}
                    >
                      Potwierdz do planu
                    </Button>
                  </div>
                  {(!viewing.plannedDateFrom || !viewing.plannedDateTo) && (
                    <p className="text-xs text-muted-foreground">
                      Potwierdzenie wymaga uzupelnienia planowanej daty wykonania operacji.
                    </p>
                  )}
                </div>
              )}

              {(isPlanner && plannerResignationStatuses.includes(viewing.status)) && (
                <Button size="sm" variant="outline" onClick={() => requestStatusChange(viewing.id, 7)} disabled={updateMut.isPending}>Rezygnuj</Button>
              )}

              {(isPlanner && viewing.status === 7) && (
                <Button size="sm" variant="secondary" onClick={() => requestStatusChange(viewing.id, 1)} disabled={updateMut.isPending}>Wznów</Button>
              )}

              {(isPilot && viewing.status === 4) && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => requestStatusChange(viewing.id, 5)} disabled={updateMut.isPending}>Zrealizowane w czesci</Button>
                  <Button size="sm" onClick={() => requestStatusChange(viewing.id, 6)} disabled={updateMut.isPending}>Zrealizowane w calosci</Button>
                  <Button size="sm" variant="secondary" onClick={() => requestStatusChange(viewing.id, 3)} disabled={updateMut.isPending}>Nie zrealizowane</Button>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Komentarze</h3>
                {viewing.comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Brak komentarzy.</p>
                ) : (
                  viewing.comments.map((comment, index) => (
                    <div key={`${comment.createdAt}-${index}`} className="rounded-md border p-2 text-xs">
                      <p>{comment.content}</p>
                      <p className="text-muted-foreground">{comment.authorEmail} - {new Date(comment.createdAt).toLocaleString('pl-PL')}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Historia zmian</h3>
                {viewing.history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Brak wpisow historii.</p>
                ) : (
                  viewing.history.slice().reverse().map((entry, index) => (
                    <div key={`${entry.changedAt}-${index}`} className="rounded-md border p-2 text-xs">
                      <p className="font-medium">{toHistoryActionLabel(entry.action)}</p>
                      {toHistoryStatusChangeLabel(entry) && (
                        <p className="text-muted-foreground">{toHistoryStatusChangeLabel(entry)}</p>
                      )}
                      <p className="text-muted-foreground">
                        {entry.actorEmail} - {new Date(entry.changedAt).toLocaleString('pl-PL')}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingStatusAction)} onOpenChange={(openValue) => {
        if (!openValue) setPendingStatusAction(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingStatusAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pendingStatusAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingStatusAction) return;
                updateStatus(pendingStatusAction.operationId, pendingStatusAction.status);
                setPendingStatusAction(null);
              }}
            >
              Potwierdz
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OperationsPage;
