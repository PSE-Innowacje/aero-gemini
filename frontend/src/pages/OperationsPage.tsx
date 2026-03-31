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
import { Plus, Pencil, Eye } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

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
  survey: 'survey',
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
  const [statusFilter, setStatusFilter] = useState<string>('all');
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
    mutationFn: ({ file }: { file: File }) =>
      createOperationFromKml(
        {
          projectCode: form.projectCode,
          shortDescription: form.shortDescription,
          proposedDateFrom: form.proposedDateFrom || undefined,
          proposedDateTo: form.proposedDateTo || undefined,
          plannedDateFrom: form.plannedDateFrom || undefined,
          plannedDateTo: form.plannedDateTo || undefined,
          activities: form.activities,
          extraInfo: form.extraInfo || undefined,
          contacts: form.contactsRaw
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        },
        file
      ),
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

  const filtered = statusFilter === 'all' ? operations : operations.filter((o) => o.status === Number(statusFilter));
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
        <h1 className="text-2xl font-bold text-foreground">Planowane operacje lotnicze</h1>
        {(isPlanner || isSupervisor) && (
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Dodaj</Button>
        )}
      </div>

      <div className="flex items-center gap-2">
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
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nr</TableHead>
              <TableHead>Nr zlecenia/projektu</TableHead>
              <TableHead>Opis</TableHead>
              <TableHead>Czynnosci</TableHead>
              <TableHead>Km</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((operation) => (
              <TableRow key={operation.id}>
                <TableCell>{operation.id}</TableCell>
                <TableCell className="font-medium">{operation.projectCode}</TableCell>
                <TableCell className="max-w-[280px] truncate">{operation.shortDescription}</TableCell>
                <TableCell>{operation.activities.map((value) => toActivityLabel(value)).join(', ') || '-'}</TableCell>
                <TableCell>{operation.distanceKm}</TableCell>
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
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  Brak operacji dla wybranego filtra.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={handleFormDialogChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edytuj operacje' : 'Nowa operacja'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input maxLength={30} placeholder="Nr zlecenia/projektu" value={form.projectCode} onChange={(e) => setForm((f) => ({ ...f, projectCode: e.target.value }))} required />
            <p className="text-right text-xs text-muted-foreground">{form.projectCode.length}/30</p>
            <Textarea maxLength={100} placeholder="Opis skrocony" value={form.shortDescription} onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))} required />
            <p className="text-right text-xs text-muted-foreground">{form.shortDescription.length}/100</p>

            <div>
              <label className="text-sm font-medium text-foreground">Rodzaj czynnosci (min. 1)</label>
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
                <p className="mt-1 text-xs text-destructive">Wymagany wybor przynajmniej jednej czynnosci.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={form.proposedDateFrom} onChange={(e) => setForm((f) => ({ ...f, proposedDateFrom: e.target.value }))} />
              <Input type="date" value={form.proposedDateTo} onChange={(e) => setForm((f) => ({ ...f, proposedDateTo: e.target.value }))} />
            </div>
            {hasProposedDateRangeError && (
              <p className="text-xs text-destructive">Proponowana data od nie moze byc pozniej niz data do.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={form.plannedDateFrom}
                onChange={(e) => setForm((f) => ({ ...f, plannedDateFrom: e.target.value }))}
                disabled={isPlanner}
              />
              <Input
                type="date"
                value={form.plannedDateTo}
                onChange={(e) => setForm((f) => ({ ...f, plannedDateTo: e.target.value }))}
                disabled={isPlanner}
              />
            </div>
            {isPlanner && (
              <p className="text-xs text-muted-foreground">Planista nie moze edytowac planowanych dat i uwag po realizacji.</p>
            )}
            {hasPlannedDateRangeError && (
              <p className="text-xs text-destructive">Planowana data od nie moze byc pozniej niz data do.</p>
            )}
            <Textarea maxLength={500} placeholder="Dodatkowe informacje" value={form.extraInfo} onChange={(e) => setForm((f) => ({ ...f, extraInfo: e.target.value }))} />
            <p className="text-right text-xs text-muted-foreground">{form.extraInfo.length}/500</p>
            <Input placeholder="Osoby kontaktowe (emaile po przecinku)" value={form.contactsRaw} onChange={(e) => setForm((f) => ({ ...f, contactsRaw: e.target.value }))} />
            {invalidContacts.length > 0 && (
              <p className="text-xs text-destructive">Niepoprawne adresy: {invalidContacts.join(', ')}</p>
            )}
            <Textarea
              maxLength={500}
              placeholder="Uwagi po realizacji"
              value={form.postRealizationNotes}
              onChange={(e) => setForm((f) => ({ ...f, postRealizationNotes: e.target.value }))}
              disabled={isPlanner}
            />
            <p className="text-right text-xs text-muted-foreground">{form.postRealizationNotes.length}/500</p>
            {editing && (
              <>
                <Textarea
                  maxLength={500}
                  placeholder="Komentarz (zostanie dodany jako nowy wpis)"
                  value={form.comment}
                  onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                />
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
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Opis:</span> {viewing.shortDescription}</div>
                <div><span className="text-muted-foreground">Status:</span> <Badge className={statusColors[viewing.status]}>{operationStatusLabels[viewing.status]}</Badge></div>
                <div><span className="text-muted-foreground">Czynnosci:</span> {viewing.activities.map((value) => toActivityLabel(value)).join(', ') || '-'}</div>
                <div><span className="text-muted-foreground">Proponowane daty:</span> {viewing.proposedDateFrom || '-'} - {viewing.proposedDateTo || '-'}</div>
                <div><span className="text-muted-foreground">Planowane daty:</span> {viewing.plannedDateFrom || '-'} - {viewing.plannedDateTo || '-'}</div>
                <div><span className="text-muted-foreground">Liczba punktow:</span> {viewing.pointsCount}</div>
                <div><span className="text-muted-foreground">Liczba km trasy:</span> {viewing.distanceKm}</div>
              </div>

              <div className="text-sm">
                <p><span className="text-muted-foreground">Kontakty:</span> {viewing.contacts.join(', ') || '-'}</p>
                <p><span className="text-muted-foreground">Powiazane zlecenia:</span> {viewing.linkedFlightOrderIds.join(', ') || '-'}</p>
              </div>

              {(isSupervisor && viewing.status === 1) && (
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
              )}

              {(isPlanner && plannerResignationStatuses.includes(viewing.status)) && (
                <Button size="sm" variant="outline" onClick={() => requestStatusChange(viewing.id, 7)} disabled={updateMut.isPending}>Rezygnuj</Button>
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
                      <p className="font-medium">{entry.action}</p>
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
