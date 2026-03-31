import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createUser, deleteUser, fetchUsers } from '@/api/api';
import type { Role } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2 } from 'lucide-react';

const UsersPage: React.FC = () => {
  const qc = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'PLANNER' as Role,
  });

  const createMut = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setOpen(false);
      setForm({ firstName: '', lastName: '', email: '', password: '', role: 'PLANNER' });
      toast({ title: 'Dodano użytkownika' });
    },
    onError: (error: Error) => {
      toast({ title: 'Błąd zapisu', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'Usunięto użytkownika' });
    },
    onError: (error: Error) => {
      toast({ title: 'Błąd usuwania', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate(form);
  };

  const handleDelete = (id: string, name: string) => {
    if (id === currentUserId) {
      toast({
        title: 'Operacja niedozwolona',
        description: 'Nie możesz usunąć własnego konta.',
        variant: 'destructive',
      });
      return;
    }
    const confirmed = window.confirm(`Czy na pewno chcesz usunąć użytkownika ${name}?`);
    if (!confirmed) return;
    deleteMut.mutate(id);
  };

  if (isLoading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Użytkownicy</h1>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Dodaj</Button>
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Imię i nazwisko</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rola</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell><Badge variant="secondary">{u.role}</Badge></TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(u.id, u.name)}
                    disabled={deleteMut.isPending || u.id === currentUserId}
                    aria-label={`Usuń użytkownika ${u.name}`}
                    title={u.id === currentUserId ? 'Nie możesz usunąć własnego konta' : undefined}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nowy użytkownik</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-first-name">Imię</Label>
              <Input
                id="user-first-name"
                value={form.firstName}
                onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-last-name">Nazwisko</Label>
              <Input
                id="user-last-name"
                value={form.lastName}
                onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Adres e-mail</Label>
              <Input
                id="user-email"
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">Hasło</Label>
              <Input
                id="user-password"
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-role">Rola</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as Role }))}>
                <SelectTrigger id="user-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrator</SelectItem>
                  <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                  <SelectItem value="PLANNER">Planner</SelectItem>
                  <SelectItem value="PILOT">Pilot</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={createMut.isPending}>
              {createMut.isPending ? 'Zapisywanie...' : 'Dodaj'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;
