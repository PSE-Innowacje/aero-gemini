import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchHelicopters, createHelicopter, updateHelicopter } from '@/api/api';
import type { Helicopter } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil } from 'lucide-react';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-red-100 text-red-800',
};

const HelicoptersPage: React.FC = () => {
  const qc = useQueryClient();
  const { data: helicopters = [], isLoading } = useQuery({ queryKey: ['helicopters'], queryFn: fetchHelicopters });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Helicopter | null>(null);
  const [form, setForm] = useState({ registration: '', type: '', status: 'active' as Helicopter['status'], maxRange: 0, maxWeight: 0 });

  const createMut = useMutation({
    mutationFn: (d: Omit<Helicopter, 'id'>) => createHelicopter(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['helicopters'] }); setOpen(false); toast({ title: 'Dodano helikopter' }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: Partial<Helicopter> & { id: string }) => updateHelicopter(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['helicopters'] }); setOpen(false); toast({ title: 'Zaktualizowano' }); },
  });

  const openCreate = () => { setEditing(null); setForm({ registration: '', type: '', status: 'active', maxRange: 0, maxWeight: 0 }); setOpen(true); };
  const openEdit = (h: Helicopter) => { setEditing(h); setForm({ registration: h.registration, type: h.type, status: h.status, maxRange: h.maxRange, maxWeight: h.maxWeight }); setOpen(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) updateMut.mutate({ id: editing.id, ...form });
    else createMut.mutate(form);
  };

  if (isLoading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Helikoptery</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Dodaj</Button>
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rejestracja</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Zasięg (km)</TableHead>
              <TableHead>Maks. masa (kg)</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {helicopters.map(h => (
              <TableRow key={h.id}>
                <TableCell className="font-medium">{h.registration}</TableCell>
                <TableCell>{h.type}</TableCell>
                <TableCell><Badge className={statusColors[h.status]}>{h.status}</Badge></TableCell>
                <TableCell>{h.maxRange}</TableCell>
                <TableCell>{h.maxWeight}</TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(h)}><Pencil className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edytuj helikopter' : 'Nowy helikopter'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input placeholder="Rejestracja" value={form.registration} onChange={e => setForm(f => ({ ...f, registration: e.target.value }))} required />
            <Input placeholder="Typ" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} required />
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as Helicopter['status'] }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Zasięg (km)" value={form.maxRange || ''} onChange={e => setForm(f => ({ ...f, maxRange: Number(e.target.value) }))} required />
            <Input type="number" placeholder="Maks. masa (kg)" value={form.maxWeight || ''} onChange={e => setForm(f => ({ ...f, maxWeight: Number(e.target.value) }))} required />
            <Button type="submit" className="w-full">{editing ? 'Zapisz' : 'Dodaj'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HelicoptersPage;
