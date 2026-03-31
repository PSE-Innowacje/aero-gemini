import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchHelicopters, createHelicopter, updateHelicopter } from '@/api/api';
import type { Helicopter } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [form, setForm] = useState({
    registration: '',
    type: '',
    description: '',
    maxCrew: 1,
    status: 'active' as Helicopter['status'],
    inspectionValidUntil: '',
    maxRange: 0,
    maxWeight: 0,
  });

  const createMut = useMutation({
    mutationFn: (d: Omit<Helicopter, 'id'>) => createHelicopter(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['helicopters'] }); setOpen(false); toast({ title: 'Dodano helikopter' }); },
    onError: (error: Error) => { toast({ title: 'Błąd zapisu', description: error.message, variant: 'destructive' }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: Partial<Helicopter> & { id: string }) => updateHelicopter(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['helicopters'] }); setOpen(false); toast({ title: 'Zaktualizowano' }); },
    onError: (error: Error) => { toast({ title: 'Błąd aktualizacji', description: error.message, variant: 'destructive' }); },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      registration: '',
      type: '',
      description: '',
      maxCrew: 1,
      status: 'active',
      inspectionValidUntil: '',
      maxRange: 0,
      maxWeight: 0,
    });
    setOpen(true);
  };
  const openEdit = (h: Helicopter) => {
    setEditing(h);
    setForm({
      registration: h.registration,
      type: h.type,
      description: h.description ?? '',
      maxCrew: h.maxCrew,
      status: h.status,
      inspectionValidUntil: h.inspectionValidUntil ? h.inspectionValidUntil.split('T')[0] : '',
      maxRange: h.maxRange,
      maxWeight: h.maxWeight,
    });
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.description.length > 100) {
      toast({
        title: 'Błąd walidacji',
        description: 'Opis może mieć maksymalnie 100 znaków.',
        variant: 'destructive',
      });
      return;
    }
    if (!Number.isInteger(form.maxCrew) || form.maxCrew < 1 || form.maxCrew > 10) {
      toast({
        title: 'Błąd walidacji',
        description: 'Maks. liczba członków załogi musi być w zakresie 1-10.',
        variant: 'destructive',
      });
      return;
    }
    if (!Number.isInteger(form.maxWeight) || form.maxWeight < 1 || form.maxWeight > 1000) {
      toast({
        title: 'Błąd walidacji',
        description: 'Maks. udźwig załogi musi być w zakresie 1-1000 kg.',
        variant: 'destructive',
      });
      return;
    }
    if (form.status === 'active' && !form.inspectionValidUntil) {
      toast({
        title: 'Błąd walidacji',
        description: 'Data ważności przeglądu jest wymagana dla aktywnego helikoptera.',
        variant: 'destructive',
      });
      return;
    }
    const payload = {
      ...form,
      inspectionValidUntil: form.status === 'active' ? form.inspectionValidUntil : null,
    };
    if (editing) updateMut.mutate({ id: editing.id, ...payload });
    else createMut.mutate(payload);
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
              <TableHead>Opis</TableHead>
              <TableHead>Maks. liczba załogi</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ważność przeglądu</TableHead>
              <TableHead>Zasięg (km)</TableHead>
              <TableHead>Maks. udźwig załogi (kg)</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {helicopters.map(h => (
              <TableRow key={h.id}>
                <TableCell className="font-medium">{h.registration}</TableCell>
                <TableCell>{h.type}</TableCell>
                <TableCell>{h.description || '-'}</TableCell>
                <TableCell>{h.maxCrew}</TableCell>
                <TableCell><Badge className={statusColors[h.status]}>{h.status === 'active' ? 'Aktywny' : 'Nieaktywny'}</Badge></TableCell>
                <TableCell>{h.inspectionValidUntil ? h.inspectionValidUntil.split('T')[0] : '-'}</TableCell>
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
            <div className="space-y-2">
              <Label htmlFor="helicopter-registration">Rejestracja</Label>
              <Input
                id="helicopter-registration"
                placeholder="Rejestracja"
                value={form.registration}
                onChange={e => setForm(f => ({ ...f, registration: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="helicopter-type">Typ</Label>
              <Input
                id="helicopter-type"
                placeholder="Typ"
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="helicopter-description">Opis</Label>
              <Input
                id="helicopter-description"
                placeholder="Opis"
                maxLength={100}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">{form.description.length}/100 znaków</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="helicopter-max-crew">Maks. liczba członków załogi</Label>
              <Input
                id="helicopter-max-crew"
                type="number"
                min={1}
                max={10}
                step={1}
                value={form.maxCrew || ''}
                onChange={e => setForm(f => ({ ...f, maxCrew: Number(e.target.value) }))}
                required
              />
              <p className="text-xs text-muted-foreground">Dozwolony zakres: 1-10</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="helicopter-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={v => setForm(f => ({
                  ...f,
                  status: v as Helicopter['status'],
                  inspectionValidUntil: v === 'active' ? f.inspectionValidUntil : '',
                }))}
              >
                <SelectTrigger id="helicopter-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktywny</SelectItem>
                  <SelectItem value="inactive">Nieaktywny</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="helicopter-inspection">Data ważności przeglądu</Label>
              <Input
                id="helicopter-inspection"
                type="date"
                value={form.inspectionValidUntil}
                onChange={e => setForm(f => ({ ...f, inspectionValidUntil: e.target.value }))}
                required={form.status === 'active'}
                disabled={form.status !== 'active'}
              />
              {form.status === 'active' && (
                <p className="text-xs text-muted-foreground">Pole wymagane dla statusu aktywny</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="helicopter-range">Zasięg (km)</Label>
              <Input
                id="helicopter-range"
                type="number"
                placeholder="Zasięg (km)"
                value={form.maxRange || ''}
                onChange={e => setForm(f => ({ ...f, maxRange: Number(e.target.value) }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="helicopter-max-weight">Maks. udźwig załogi (kg)</Label>
              <Input
                id="helicopter-max-weight"
                type="number"
                placeholder="Maks. udźwig załogi (kg)"
                min={1}
                max={1000}
                step={1}
                value={form.maxWeight || ''}
                onChange={e => setForm(f => ({ ...f, maxWeight: Number(e.target.value) }))}
                required
              />
              <p className="text-xs text-muted-foreground">Dozwolony zakres: 1-1000 kg</p>
            </div>
            <Button type="submit" className="w-full">{editing ? 'Zapisz' : 'Dodaj'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HelicoptersPage;
