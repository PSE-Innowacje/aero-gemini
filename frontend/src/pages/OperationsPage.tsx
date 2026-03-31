import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchOperations, createOperation, updateOperation } from '@/api/api';
import type { PlannedOperation, OperationStatus } from '@/types';
import { operationStatusLabels } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Eye } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const statusColors: Record<OperationStatus, string> = {
  1: 'bg-gray-100 text-gray-800',
  2: 'bg-blue-100 text-blue-800',
  3: 'bg-green-100 text-green-800',
  4: 'bg-yellow-100 text-yellow-800',
  5: 'bg-purple-100 text-purple-800',
};

const allActivities = ['Survey', 'Transport', 'Rescue', 'Medical', 'Photography', 'Inspection'];

const OperationsPage: React.FC = () => {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { data: operations = [], isLoading } = useQuery({ queryKey: ['operations'], queryFn: fetchOperations });
  const [statusFilter, setStatusFilter] = useState<string>('3');
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<PlannedOperation | null>(null);
  const [viewing, setViewing] = useState<PlannedOperation | null>(null);
  const [form, setForm] = useState({ projectCode: '', activities: [] as string[], startDate: '', endDate: '', status: 1 as OperationStatus, description: '' });

  const createMut = useMutation({
    mutationFn: (d: Omit<PlannedOperation, 'id'>) => createOperation(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['operations'] }); setOpen(false); toast({ title: 'Dodano operację' }); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: Partial<PlannedOperation> & { id: string }) => updateOperation(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['operations'] }); setOpen(false); setDetailOpen(false); toast({ title: 'Zaktualizowano' }); },
  });

  const filtered = statusFilter === 'all' ? operations : operations.filter(o => o.status === Number(statusFilter));

  const openCreate = () => { setEditing(null); setForm({ projectCode: '', activities: [], startDate: '', endDate: '', status: 1, description: '' }); setOpen(true); };
  const openEdit = (o: PlannedOperation) => { setEditing(o); setForm({ projectCode: o.projectCode, activities: o.activities, startDate: o.startDate, endDate: o.endDate, status: o.status, description: o.description }); setOpen(true); };

  const toggleActivity = (a: string) => {
    setForm(f => ({ ...f, activities: f.activities.includes(a) ? f.activities.filter(x => x !== a) : [...f.activities, a] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) updateMut.mutate({ id: editing.id, ...form });
    else createMut.mutate(form);
  };

  const canChangeStatus = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  if (isLoading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Planowane operacje</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Dodaj</Button>
      </div>

      <div className="flex gap-2 items-center">
        <span className="text-sm text-muted-foreground">Status:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie</SelectItem>
            {([1, 2, 3, 4, 5] as OperationStatus[]).map(s => (
              <SelectItem key={s} value={String(s)}>{operationStatusLabels[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Kod projektu</TableHead>
              <TableHead>Aktywności</TableHead>
              <TableHead>Daty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(o => (
              <TableRow key={o.id}>
                <TableCell>{o.id}</TableCell>
                <TableCell className="font-medium">{o.projectCode}</TableCell>
                <TableCell>{o.activities.join(', ')}</TableCell>
                <TableCell className="text-sm">{o.startDate} — {o.endDate}</TableCell>
                <TableCell><Badge className={statusColors[o.status]}>{operationStatusLabels[o.status]}</Badge></TableCell>
                <TableCell className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setViewing(o); setDetailOpen(true); }}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(o)}><Pencil className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edytuj operację' : 'Nowa operacja'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input placeholder="Kod projektu" value={form.projectCode} onChange={e => setForm(f => ({ ...f, projectCode: e.target.value }))} required />
            <div>
              <label className="text-sm font-medium text-foreground">Aktywności</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {allActivities.map(a => (
                  <Badge key={a} className={`cursor-pointer ${form.activities.includes(a) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`} onClick={() => toggleActivity(a)}>
                    {a}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
              <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required />
            </div>
            <Textarea placeholder="Opis" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <Button type="submit" className="w-full">{editing ? 'Zapisz' : 'Dodaj'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Operacja {viewing?.projectCode}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Aktywności:</span> {viewing.activities.join(', ')}</div>
                <div><span className="text-muted-foreground">Daty:</span> {viewing.startDate} — {viewing.endDate}</div>
                <div><span className="text-muted-foreground">Status:</span> <Badge className={statusColors[viewing.status]}>{operationStatusLabels[viewing.status]}</Badge></div>
              </div>
              <p className="text-sm">{viewing.description}</p>
              {canChangeStatus && (
                <div className="flex gap-2">
                  {([1, 2, 3, 4, 5] as OperationStatus[]).filter(s => s !== viewing.status).map(s => (
                    <Button key={s} size="sm" variant="outline" onClick={() => updateMut.mutate({ id: viewing.id, status: s })}>
                      → {operationStatusLabels[s]}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OperationsPage;
