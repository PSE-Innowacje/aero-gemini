import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const mockUsers = [
  { id: '1', email: 'admin@heli.app', name: 'Jan Kowalski', role: 'ADMIN' },
  { id: '2', email: 'planner@heli.app', name: 'Anna Nowak', role: 'PLANNER' },
  { id: '3', email: 'supervisor@heli.app', name: 'Piotr Wiśniewski', role: 'SUPERVISOR' },
  { id: '4', email: 'pilot@heli.app', name: 'Marek Zieliński', role: 'PILOT' },
];

const UsersPage: React.FC = () => {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Użytkownicy</h1>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Imię i nazwisko</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rola</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockUsers.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell><Badge variant="secondary">{u.role}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default UsersPage;
