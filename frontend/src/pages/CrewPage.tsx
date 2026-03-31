import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCrew, createCrewMember, updateCrewMember } from '@/api/api';
import type { CrewMember, CrewRole } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Eye, AlertTriangle } from 'lucide-react';

const CrewPage: React.FC = () => {
  const qc = useQueryClient();
  const { data: crew = [], isLoading } = useQuery({ queryKey: ['crew'], queryFn: fetchCrew });
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editing, setEditing] = useState<CrewMember | null>(null);
  const [previewing, setPreviewing] = useState<CrewMember | null>(null);
  const [form, setForm] = useState({ email: '', name: '', role: 'PILOT' as CrewRole, licenseExpiry: '', weight: 0 });

  const createMut = useMutation({
    mutationFn: (d: Omit<CrewMember, 'id'>) => createCrewMember(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crew'] }); setOpen(false); toast({ title: 'Dodano członka załogi' }); },
    onError: (error: Error) => { toast({ title: 'Błąd zapisu', description: error.message, variant: 'destructive' }); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: Partial<CrewMember> & { id: string }) => updateCrewMember(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crew'] }); setOpen(false); toast({ title: 'Zaktualizowano' }); },
    onError: (error: Error) => { toast({ title: 'Błąd aktualizacji', description: error.message, variant: 'destructive' }); },
  });

  const openCreate = () => { setEditing(null); setForm({ email: '', name: '', role: 'PILOT', licenseExpiry: '', weight: 0 }); setOpen(true); };
  const openEdit = (c: CrewMember) => { setEditing(c); setForm({ email: c.email, name: c.name, role: c.role, licenseExpiry: c.licenseExpiry, weight: c.weight }); setOpen(true); };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) updateMut.mutate({ id: editing.id, ...form });
    else createMut.mutate(form);
  };

  const toDateOnly = (value?: string | null) => {
    if (!value) return null;
    return value.split('T')[0];
  };
  const isExpired = (date?: string | null) => {
    if (!date) return true;
    const target = new Date(date);
    const today = new Date();
    target.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return target < today;
  };
  const getValidityLabel = (date?: string | null) => (isExpired(date) ? 'Nieważna' : 'Ważna');

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
              <TableHead>Podgląd uprawnień</TableHead>
              <TableHead>Waga (kg)</TableHead>
              <TableHead className="w-24" />
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
                    {toDateOnly(c.licenseExpiry)}
                  </span>
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setPreviewing(c); setPreviewOpen(true); }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Podgląd
                  </Button>
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
            <div className="space-y-2">
              <Label htmlFor="crew-name">Imię i nazwisko</Label>
              <Input
                id="crew-name"
                placeholder="Imię i nazwisko"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crew-email">Adres e-mail</Label>
              <Input
                id="crew-email"
                type="email"
                placeholder="Adres e-mail"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crew-role">Rola w załodze</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as CrewRole }))}>
                <SelectTrigger id="crew-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PILOT">Pilot</SelectItem>
                  <SelectItem value="OBSERVER">Obserwator</SelectItem>
                  <SelectItem value="CREW">Członek załogi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="crew-license-expiry">{form.role === 'PILOT' ? 'Ważność licencji do' : 'Ważność szkolenia do'}</Label>
              <Input
                id="crew-license-expiry"
                type="date"
                value={form.licenseExpiry}
                onChange={e => setForm(f => ({ ...f, licenseExpiry: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crew-weight">Waga (kg)</Label>
              <Input
                id="crew-weight"
                type="number"
                placeholder="Waga (kg)"
                value={form.weight || ''}
                onChange={e => setForm(f => ({ ...f, weight: Number(e.target.value) }))}
                required
              />
            </div>
            <Button type="submit" className="w-full">{editing ? 'Zapisz' : 'Dodaj'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Podgląd uprawnień</DialogTitle></DialogHeader>
          {previewing && (
            <div className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Członek załogi:</span> {previewing.name}</div>
              <div><span className="text-muted-foreground">Rola:</span> {previewing.role}</div>
              {previewing.role === 'PILOT' && (
                <div><span className="text-muted-foreground">Numer licencji pilota:</span> {previewing.pilotLicenseNumber ?? 'Brak'}</div>
              )}
              {previewing.role === 'PILOT' ? (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Ważność licencji:</span>
                  <span>{toDateOnly(previewing.licenseValidUntil) ?? 'Brak'}</span>
                  <Badge variant={isExpired(previewing.licenseValidUntil) ? 'destructive' : 'secondary'}>
                    {getValidityLabel(previewing.licenseValidUntil)}
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Ważność szkolenia:</span>
                  <span>{toDateOnly(previewing.trainingValidUntil) ?? 'Brak'}</span>
                  <Badge variant={isExpired(previewing.trainingValidUntil) ? 'destructive' : 'secondary'}>
                    {getValidityLabel(previewing.trainingValidUntil)}
                  </Badge>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CrewPage;
