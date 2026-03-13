import { useState } from "react";
import { Plus, Edit, Trash2, AlertTriangle, Layers } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListOrgLevel2, useCreateOrgLevel2, useUpdateOrgLevel2, useDeleteOrgLevel2, useListOrgLevel1, getListOrgLevel2QueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useSettings } from "@/contexts/settings-context";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function UnitsPage() {
  const queryClient = useQueryClient();
  const { tier1Label, tier2Label, tier2LabelPlural } = useSettings();
  const { data: user } = useGetCurrentUser();
  const canEdit = (user as any)?.role === "admin" || (user as any)?.role === "manager";

  const { data: items = [], isLoading } = useListOrgLevel2();
  const { data: level1s = [] } = useListOrgLevel1();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [level1Id, setLevel1Id] = useState<string>("none");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListOrgLevel2QueryKey() });

  const create = useCreateOrgLevel2({ mutation: { onSuccess: () => { invalidate(); setDialogOpen(false); toast({ title: `${tier2Label} created` }); }, onError: () => toast({ title: "Error", variant: "destructive" }) } });
  const update = useUpdateOrgLevel2({ mutation: { onSuccess: () => { invalidate(); setDialogOpen(false); toast({ title: `${tier2Label} updated` }); }, onError: () => toast({ title: "Error", variant: "destructive" }) } });
  const remove = useDeleteOrgLevel2({ mutation: { onSuccess: () => { invalidate(); setDeleteId(null); toast({ title: `${tier2Label} deleted` }); }, onError: () => toast({ title: "Error", variant: "destructive" }) } });

  const openCreate = () => { setEditItem(null); setName(""); setDescription(""); setLevel1Id("none"); setDialogOpen(true); };
  const openEdit = (item: any) => { setEditItem(item); setName(item.name); setDescription(item.description ?? ""); setLevel1Id(item.level1Id ? String(item.level1Id) : "none"); setDialogOpen(true); };

  const handleSubmit = () => {
    if (!name.trim()) return;
    const payload = { name: name.trim(), description: description.trim() || undefined, level1Id: level1Id !== "none" ? Number(level1Id) : null };
    if (editItem) update.mutate({ id: editItem.id, data: payload as any });
    else create.mutate({ data: payload as any });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
              <Layers className="w-7 h-7 text-primary" /> {tier2LabelPlural}
            </h1>
            <p className="text-muted-foreground font-mono text-sm mt-1 uppercase tracking-wider">Mid-level organizational units</p>
          </div>
          {canEdit && (
            <Button onClick={openCreate} className="font-display uppercase tracking-widest text-xs">
              <Plus className="w-4 h-4 mr-2" /> Add {tier2Label}
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-36" />)}
          </div>
        ) : items.length === 0 ? (
          <Card className="p-12 text-center border-dashed border-border/50">
            <Layers className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="font-display uppercase tracking-widest text-muted-foreground">No {tier2LabelPlural} yet</p>
            {canEdit && <Button onClick={openCreate} variant="outline" className="mt-4 font-display uppercase tracking-widest text-xs"><Plus className="w-4 h-4 mr-2" /> Add {tier2Label}</Button>}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item: any) => (
              <Card key={item.id} className="p-5 border-border/50 bg-card hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 border border-primary/30 rounded-sm flex items-center justify-center">
                      <Layers className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold uppercase tracking-wider text-foreground">{item.name}</h3>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">{item.memberCount} sub-unit{item.memberCount !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={() => openEdit(item)}><Edit className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  )}
                </div>
                {item.level1Name && (
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <Badge variant="secondary" className="text-[10px] font-mono uppercase tracking-wider">{tier1Label}: {item.level1Name}</Badge>
                  </div>
                )}
                {item.description && <p className="text-xs font-mono text-muted-foreground mt-2">{item.description}</p>}
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border/50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-widest">{editItem ? `Edit ${tier2Label}` : `New ${tier2Label}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1.5">Name *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g., Alpha ${tier2Label}`} className="font-mono" />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1.5">{tier1Label} (optional)</label>
              <Select value={level1Id} onValueChange={setLevel1Id}>
                <SelectTrigger className="font-mono"><SelectValue placeholder={`Select ${tier1Label}`} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="font-mono">— None —</SelectItem>
                  {(level1s as any[]).map((l: any) => (
                    <SelectItem key={l.id} value={String(l.id)} className="font-mono">{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1.5">Description</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" className="font-mono" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="font-display uppercase tracking-widest text-xs">Cancel</Button>
            <Button onClick={handleSubmit} disabled={!name.trim() || create.isPending || update.isPending} className="font-display uppercase tracking-widest text-xs">
              {editItem ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display uppercase tracking-widest text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
              This {tier2Label.toLowerCase()} will be removed. Its {tier2Label.toLowerCase()}'s squads will be unlinked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-display uppercase tracking-widest text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && remove.mutate({ id: deleteId })} className="bg-destructive text-destructive-foreground font-display uppercase tracking-widest text-xs">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
