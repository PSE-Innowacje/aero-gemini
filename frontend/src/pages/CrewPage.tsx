import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCrew, createCrewMember, updateCrewMember } from '@/api/api';
import type { CrewMember, Role } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, AlertTriangle } from 'lucide-react';

const CrewPage: React.FC = () => {
  const qc = useQueryClient();
  const { data: crew = [], isLoading } = useQuery({ queryKey: ['crew'], queryFn: fetchCrew });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CrewMember | null>(null);
  const [form, setForm] = useState({ email: '', name: '', role: 'PILOT' as Role, licenseExpiry: '', weight: 0 });

  const createMut = useMutation({
    mutationFn: (d: Omit<CrewMember, 'id'>) => createCrewMember(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crew'] }); setOpen(false); toast({ title: 'Dodano członka załogi' }); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: Partial<CrewMember> & { id: string }) => updateCrewMember(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crew'] }); setOpen(false); toast({ title: 'Zaktualizowano' }); },
  });

  const openCreate = () => { setEditing(null); setForm({ email: '', name: '', role: 'PILOT', licenseExpiry: '', weight: 0 }); setOpen(true); };
  const openEdit = (c: CrewMember) => { setEditing(c); setForm({ email: c.email, name: c.name, role: c.role, licenseExpiry: c.licenseExpiry, weight: c.weight }); setOpen(true); };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) updateMut.mutate({ id: editing.id, ...form });
    else createMut.mutate(form);
  };

  const isExpired = (date: string) => new Date(date) < new Date();

  if (isLoading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Załoga</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Dodaj</Button>
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Imię i nazwisko</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rola</TableHead>
              <TableHead>Licencja ważna do</TableHead>
              <TableHead>Waga (kg)</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {crew.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.email}</TableCell>
                <TableCell><Badge variant="secondary">{c.role}</Badge></TableCell>
                <TableCell>
                  <span className={isExpired(c.licenseExpiry) ? 'text-destructive flex items-center gap-1' : ''}>
                    {isExpired(c.licenseExpiry) && <AlertTriangle className="h-3 w-3" />}
                    {c.licenseExpiry}
                  </span>
                </TableCell>
                <TableCell>{c.weight}</TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edytuj członka załogi' : 'Nowy członek załogi'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input placeholder="Imię i nazwisko" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            <Input type="email" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as Role }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="PILOT">Pilot</SelectItem>
                <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                <SelectItem value="PLANNER">Planner</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={form.licenseExpiry} onChange={e => setForm(f => ({ ...f, licenseExpiry: e.target.value }))} required />
            <Input type="number" placeholder="Waga (kg)" value={form.weight || ''} onChange={e => setForm(f => ({ ...f, weight: Number(e.target.value) }))} required />
            <Button type="submit" className="w-full">{editing ? 'Zapisz' : 'Dodaj'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CrewPage;
