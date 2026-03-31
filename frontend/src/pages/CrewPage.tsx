import React, { useMemo, useState } from 'react';
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
import { Plus, Pencil, Eye, AlertTriangle, ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';

const CrewPage: React.FC = () => {
  const qc = useQueryClient();
  const { data: crew = [], isLoading } = useQuery({ queryKey: ['crew'], queryFn: fetchCrew });
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editing, setEditing] = useState<CrewMember | null>(null);
  const [previewing, setPreviewing] = useState<CrewMember | null>(null);
  const [form, setForm] = useState({ email: '', name: '', role: 'PILOT' as CrewRole, licenseExpiry: '', weight: 0 });
  const [roleFilter, setRoleFilter] = useState<'ALL' | CrewRole>('ALL');
  const [validityFilter, setValidityFilter] = useState<'ALL' | 'INVALID'>('ALL');
  const [sortKey, setSortKey] = useState<'name' | 'weight'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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
  const roleLabels: Record<CrewRole, string> = { PILOT: 'Pilot', OBSERVER: 'Obserwator' };

  const toggleSort = (key: 'name' | 'weight') => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection('asc');
      return;
    }
    setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const SortHeader = ({ label, column }: { label: string; column: 'name' | 'weight' }) => {
    const isActive = sortKey === column;
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => toggleSort(column)}
      >
        {label}
        {!isActive ? (
          <ArrowUpDown className="h-3 w-3" />
        ) : sortDirection === 'asc' ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>
    );
  };

  const filteredAndSortedCrew = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    return crew
      .filter(member => roleFilter === 'ALL' || member.role === roleFilter)
      .filter(member => validityFilter !== 'INVALID' || isExpired(member.licenseExpiry))
      .sort((a, b) => {
        if (sortKey === 'weight') {
          const byWeight = (a.weight - b.weight) * direction;
          if (byWeight !== 0) return byWeight;
          return a.name.localeCompare(b.name, 'pl');
        }
        const byName = a.name.localeCompare(b.name, 'pl') * direction;
        if (byName !== 0) return byName;
        return a.weight - b.weight;
    });
  }, [crew, roleFilter, sortDirection, sortKey, validityFilter]);

  if (isLoading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Załoga</h1>
        <div className="flex items-center gap-2">
          <Select value={roleFilter} onValueChange={v => setRoleFilter(v as 'ALL' | CrewRole)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filtruj po roli" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Wszystkie role</SelectItem>
              <SelectItem value="PILOT">Pilot</SelectItem>
              <SelectItem value="OBSERVER">Obserwator</SelectItem>
            </SelectContent>
          </Select>
          <Select value={validityFilter} onValueChange={v => setValidityFilter(v as 'ALL' | 'INVALID')}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Ważność uprawnień" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Wszystkie uprawnienia</SelectItem>
              <SelectItem value="INVALID">Tylko nieważne uprawnienia</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Dodaj</Button>
        </div>
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><SortHeader label="Imię i nazwisko" column="name" /></TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rola</TableHead>
              <TableHead>Uprawnienia ważne do</TableHead>
              <TableHead>Podgląd uprawnień</TableHead>
              <TableHead><SortHeader label="Waga (kg)" column="weight" /></TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedCrew.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.email}</TableCell>
                <TableCell><Badge variant="secondary">{roleLabels[c.role]}</Badge></TableCell>
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
              <div><span className="text-muted-foreground">Rola:</span> {roleLabels[previewing.role]}</div>
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
