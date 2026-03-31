import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchLandingSites, createLandingSite, updateLandingSite } from '@/api/api';
import type { LandingSite } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Plus, Pencil } from 'lucide-react';
import LeafletMap from '@/components/LeafletMap';
import type { MapMarker } from '@/components/LeafletMap';
import { queryKeys } from '@/lib/queryKeys';
import { buildMutationOptions } from '@/lib/reactQuery/mutationOptions';

const LandingSitesPage: React.FC = () => {
  const qc = useQueryClient();
  const { data: sites = [], isLoading } = useQuery({ queryKey: queryKeys.landingSites, queryFn: fetchLandingSites });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LandingSite | null>(null);
  const [form, setForm] = useState({ name: '', latitude: 50.06, longitude: 19.94, elevation: 0, status: 'active' as LandingSite['status'] });
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const createMut = useMutation({
    mutationFn: (d: Omit<LandingSite, 'id'>) => createLandingSite(d),
    ...buildMutationOptions({
      queryClient: qc,
      invalidateQueryKey: queryKeys.landingSites,
      successTitle: 'Dodano lądowisko',
      errorTitle: 'Błąd zapisu',
      onSuccess: () => setOpen(false),
    }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: Partial<LandingSite> & { id: string }) => updateLandingSite(id, d),
    ...buildMutationOptions({
      queryClient: qc,
      invalidateQueryKey: queryKeys.landingSites,
      successTitle: 'Zaktualizowano',
      errorTitle: 'Błąd aktualizacji',
      onSuccess: () => setOpen(false),
    }),
  });

  const openCreate = () => { setEditing(null); setForm({ name: '', latitude: 50.06, longitude: 19.94, elevation: 0, status: 'active' }); setOpen(true); };
  const openEdit = (s: LandingSite) => { setEditing(s); setForm({ name: s.name, latitude: s.latitude, longitude: s.longitude, elevation: s.elevation, status: s.status }); setOpen(true); };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) updateMut.mutate({ id: editing.id, ...form });
    else createMut.mutate(form);
  };

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setForm(f => ({ ...f, latitude: lat, longitude: lng }));
  }, []);

  const handleMarkerClick = useCallback((id: string) => {
    setSelectedSiteId(prev => prev === id ? null : id);
  }, []);

  const handleRowClick = useCallback((id: string) => {
    setSelectedSiteId(prev => prev === id ? null : id);
  }, []);

  // Scroll selected row into view
  useEffect(() => {
    if (selectedSiteId && rowRefs.current[selectedSiteId]) {
      rowRefs.current[selectedSiteId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedSiteId]);

  const siteMarkers: MapMarker[] = sites.map(s => ({
    id: s.id, lat: s.latitude, lng: s.longitude,
    popup: `<strong>${s.name}</strong><br/>Wys. ${s.elevation}m`,
  }));

  const formMarker: MapMarker[] = [{ id: 'selected', lat: form.latitude, lng: form.longitude }];

  if (isLoading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Lądowiska</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Dodaj</Button>
      </div>

      <LeafletMap
        center={[50.06, 19.94]}
        zoom={8}
        markers={siteMarkers}
        onMarkerClick={handleMarkerClick}
        selectedMarkerId={selectedSiteId}
      />

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nazwa</TableHead>
              <TableHead>Szerokość</TableHead>
              <TableHead>Długość</TableHead>
              <TableHead>Wysokość (m)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sites.map(s => (
              <TableRow
                key={s.id}
                ref={el => { rowRefs.current[s.id] = el; }}
                className={`cursor-pointer transition-colors ${selectedSiteId === s.id ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/50'}`}
                onClick={() => handleRowClick(s.id)}
              >
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.latitude.toFixed(4)}</TableCell>
                <TableCell>{s.longitude.toFixed(4)}</TableCell>
                <TableCell>{s.elevation}</TableCell>
                <TableCell><Badge className={s.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{s.status}</Badge></TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(s); }}><Pencil className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? 'Edytuj lądowisko' : 'Nowe lądowisko'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input placeholder="Nazwa" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            <LeafletMap
              center={[form.latitude, form.longitude]}
              zoom={10}
              markers={formMarker}
              onClick={handleMapClick}
              className="h-[200px]"
            />
            <p className="text-xs text-muted-foreground">Kliknij na mapę aby wybrać lokalizację</p>
            <div className="grid grid-cols-3 gap-2">
              <Input type="number" step="any" placeholder="Szerokość" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: Number(e.target.value) }))} required />
              <Input type="number" step="any" placeholder="Długość" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: Number(e.target.value) }))} required />
              <Input type="number" placeholder="Wysokość (m)" value={form.elevation || ''} onChange={e => setForm(f => ({ ...f, elevation: Number(e.target.value) }))} required />
            </div>
            <Button type="submit" className="w-full">{editing ? 'Zapisz' : 'Dodaj'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LandingSitesPage;
