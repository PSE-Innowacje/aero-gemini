import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchLandingSites, createLandingSite, updateLandingSite } from '@/api/api';
import type { LandingSite } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil } from 'lucide-react';
import LeafletMap from '@/components/LeafletMap';
import type { MapMarker } from '@/components/LeafletMap';

const LandingSitesPage: React.FC = () => {
  const qc = useQueryClient();
  const { data: sites = [], isLoading } = useQuery({ queryKey: ['landingSites'], queryFn: fetchLandingSites });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LandingSite | null>(null);
  const [form, setForm] = useState({ name: '', latitude: 52.0, longitude: 19.0 });
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const createMut = useMutation({
    mutationFn: (d: Pick<LandingSite, 'name' | 'latitude' | 'longitude'>) => createLandingSite(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['landingSites'] }); setOpen(false); toast({ title: 'Dodano lądowisko' }); },
    onError: (error: Error) => { toast({ title: 'Nie udało się dodać lądowiska', description: error.message, variant: 'destructive' }); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: Partial<LandingSite> & { id: string }) => updateLandingSite(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['landingSites'] }); setOpen(false); toast({ title: 'Zaktualizowano' }); },
    onError: (error: Error) => { toast({ title: 'Nie udało się zaktualizować lądowiska', description: error.message, variant: 'destructive' }); },
  });

  const openCreate = () => { setEditing(null); setForm({ name: '', latitude: 52.0, longitude: 19.0 }); setOpen(true); };
  const openEdit = (s: LandingSite) => { setEditing(s); setForm({ name: s.name, latitude: s.latitude, longitude: s.longitude }); setOpen(true); };
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
    popup: `<strong>${s.name}</strong>`,
  }));

  const formMarker: MapMarker[] = [{ id: 'selected', lat: form.latitude, lng: form.longitude }];
  const filteredSites = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sites;
    return sites.filter((site) => site.name.toLowerCase().includes(query));
  }, [search, sites]);

  if (isLoading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Lądowiska</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Dodaj</Button>
      </div>

      <div className="space-y-2">
        <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj lądowiska po nazwie..."
            className="self-start !w-[220px] sm:!w-[260px]"
          />
          <p className="text-sm text-muted-foreground">
            Widoczne: {filteredSites.length}/{sites.length}
          </p>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="min-h-0 overflow-hidden rounded-lg border">
          <div className="h-full overflow-auto">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Nazwa</TableHead>
                  <TableHead className="w-[25%] text-right">Szerokość geograficzna</TableHead>
                  <TableHead className="w-[25%] text-right">Długość geograficzna</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSites.map(s => (
                  <TableRow
                    key={s.id}
                    ref={el => { rowRefs.current[s.id] = el; }}
                    className={`cursor-pointer transition-colors ${selectedSiteId === s.id ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/50'}`}
                    onClick={() => handleRowClick(s.id)}
                  >
                    <TableCell className="font-medium truncate" title={s.name}>{s.name}</TableCell>
                    <TableCell className="text-right font-mono">{s.latitude.toFixed(4)}</TableCell>
                    <TableCell className="text-right font-mono">{s.longitude.toFixed(4)}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(s); }}><Pencil className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        <LeafletMap
          center={[52.0, 19.0]}
          zoom={7}
          markers={siteMarkers}
          onMarkerClick={handleMarkerClick}
          selectedMarkerId={selectedSiteId}
          className="h-full min-h-[320px]"
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edytuj lądowisko' : 'Utwórz lądowisko'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="landing-site-name" className="text-sm font-medium text-foreground">Nazwa</label>
              <Input id="landing-site-name" placeholder="Nazwa" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <label className="block text-sm font-medium text-foreground">Lokalizacja na mapie</label>
            <LeafletMap
              center={[form.latitude, form.longitude]}
              zoom={10}
              markers={formMarker}
              onClick={handleMapClick}
              className="h-[200px]"
            />
            <p className="text-xs text-muted-foreground">Kliknij na mapę aby wybrać lokalizację</p>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Współrzędne</label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label htmlFor="landing-site-latitude" className="text-sm text-foreground">Szerokość</label>
                  <Input
                    id="landing-site-latitude"
                    type="number"
                    step="any"
                    placeholder="Szerokość"
                    aria-label="Szerokość geograficzna"
                    value={form.latitude}
                    onChange={e => setForm(f => ({ ...f, latitude: Number(e.target.value) }))}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="landing-site-longitude" className="text-sm text-foreground">Długość</label>
                  <Input
                    id="landing-site-longitude"
                    type="number"
                    step="any"
                    placeholder="Długość"
                    aria-label="Długość geograficzna"
                    value={form.longitude}
                    onChange={e => setForm(f => ({ ...f, longitude: Number(e.target.value) }))}
                    required
                  />
                </div>
              </div>
            </div>
            <Button type="submit" className="w-full">{editing ? 'Zapisz' : 'Dodaj'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LandingSitesPage;
