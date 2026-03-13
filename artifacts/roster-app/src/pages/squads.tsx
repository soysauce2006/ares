import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Crosshair, Plus, Edit, Trash2, AlertTriangle, Layers } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  useListSquads, useCreateSquad, useUpdateSquad, useDeleteSquad, getListSquadsQueryKey,
  useGetCurrentUser, useListOrgLevel2,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings } from "@/contexts/settings-context";

const squadSchema = z.object({
  name: z.string().min(2, "Name required").max(50),
  description: z.string().optional(),
  level2Id: z.coerce.number().nullable().optional(),
});

export default function Squads() {
  const queryClient = useQueryClient();
  const settings = useSettings();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: currentUser } = useGetCurrentUser();
  const { data: squads, isLoading } = useListSquads();
  const { data: level2s = [] } = useListOrgLevel2();

  const { mutateAsync: createSquad, isPending: isCreating } = useCreateSquad();
  const { mutateAsync: updateSquad, isPending: isUpdating } = useUpdateSquad();
  const { mutate: deleteSquad, isPending: isDeleting } = useDeleteSquad({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListSquadsQueryKey() });
      toast({ title: "Unit Disbanded" });
      setDeleteId(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setDeleteId(null);
    }
  });

  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const form = useForm<z.infer<typeof squadSchema>>({
    resolver: zodResolver(squadSchema),
    defaultValues: { name: "", description: "", level2Id: null },
  });

  const openNewDialog = () => {
    form.reset({ name: "", description: "", level2Id: null });
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (squad: any) => {
    form.reset({
      name: squad.name,
      description: squad.description || "",
      level2Id: squad.level2Id ?? null,
    });
    setEditingId(squad.id);
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: z.infer<typeof squadSchema>) => {
    try {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        level2Id: data.level2Id ?? null,
      };
      if (editingId) {
        await updateSquad({ id: editingId, data: payload as any });
        toast({ title: "Unit Updated" });
      } else {
        await createSquad({ data: payload as any });
        toast({ title: "Unit Established" });
      }
      queryClient.invalidateQueries({ queryKey: getListSquadsQueryKey() });
      setIsDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Operation Failed", description: err.message, variant: "destructive" });
    }
  };

  // Group squads by company for display
  const grouped: { label: string; squads: any[] }[] = [];
  const ungrouped: any[] = [];

  if (squads) {
    const companyMap = new Map<number, { label: string; squads: any[] }>();
    for (const sq of squads) {
      if (sq.level2Id && (sq as any).level2Name) {
        if (!companyMap.has(sq.level2Id)) {
          companyMap.set(sq.level2Id, { label: (sq as any).level2Name, squads: [] });
        }
        companyMap.get(sq.level2Id)!.squads.push(sq);
      } else {
        ungrouped.push(sq);
      }
    }
    grouped.push(...Array.from(companyMap.values()));
    if (ungrouped.length > 0) {
      grouped.push({ label: "Unassigned", squads: ungrouped });
    }
  }

  const renderCard = (squad: any) => (
    <Card key={squad.id} className="border-border/40 bg-card/60 backdrop-blur-md relative overflow-hidden group hover:border-primary/50 transition-colors">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Crosshair className="w-24 h-24 text-primary" />
      </div>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <CardTitle className="font-display text-lg uppercase tracking-widest truncate">{squad.name}</CardTitle>
            {(squad as any).level2Name && (
              <div className="flex items-center gap-1 mt-1">
                <Layers className="w-3 h-3 text-accent/70 shrink-0" />
                <span className="font-mono text-[10px] uppercase text-accent/70 tracking-wider truncate">
                  {settings.tier2Label}: {(squad as any).level2Name}
                </span>
              </div>
            )}
          </div>
          {canManage && (
            <div className="flex gap-1 z-10 relative shrink-0">
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => openEditDialog(squad)}>
                <Edit className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(squad.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        {squad.description && (
          <p className="font-mono text-xs text-muted-foreground mt-2 line-clamp-2">{squad.description}</p>
        )}
      </CardHeader>
      <CardContent className="pt-4 border-t border-border/30 mt-2">
        <div className="flex items-end justify-between">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">Assigned Assets</span>
            <span className="font-display font-bold text-2xl text-primary">{squad.memberCount || 0}</span>
          </div>
        </div>
      </CardContent>
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-primary/10 via-primary/50 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Card>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display uppercase tracking-widest text-foreground font-bold flex items-center gap-3">
              <Crosshair className="w-8 h-8 text-primary" /> {settings.tier3LabelPlural}
            </h1>
            <p className="font-mono text-sm text-muted-foreground mt-1 uppercase">Manage tactical {settings.tier3LabelPlural.toLowerCase()} and assignments</p>
          </div>

          {canManage && (
            <Button onClick={openNewDialog} className="font-display uppercase tracking-widest shadow-[0_0_15px_rgba(218,165,32,0.2)]">
              <Plus className="w-4 h-4 mr-2" /> Form New {settings.tier3Label}
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="border-border/40 bg-card/60">
                <CardHeader>
                  <Skeleton className="h-6 w-1/2 bg-secondary/30 mb-2" />
                  <Skeleton className="h-4 w-3/4 bg-secondary/30" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-24 bg-secondary/30" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : squads?.length === 0 ? (
          <div className="py-12 text-center border border-border/30 border-dashed rounded-lg bg-black/10">
            <Crosshair className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <span className="font-mono text-muted-foreground uppercase tracking-widest">No active {settings.tier3LabelPlural.toLowerCase()}.</span>
            {canManage && (
              <div className="mt-4">
                <Button onClick={openNewDialog} variant="outline" className="font-display uppercase tracking-widest text-xs">
                  <Plus className="w-4 h-4 mr-2" /> Form New {settings.tier3Label}
                </Button>
              </div>
            )}
          </div>
        ) : grouped.length === 1 && grouped[0].label === "Unassigned" ? (
          // No grouping — all unassigned, show flat grid
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {squads?.map(renderCard)}
          </div>
        ) : (
          // Grouped by company
          <div className="space-y-8">
            {grouped.map(group => (
              <div key={group.label}>
                <div className="flex items-center gap-3 mb-4">
                  {group.label !== "Unassigned" ? (
                    <>
                      <Layers className="w-4 h-4 text-accent/70" />
                      <h2 className="font-display uppercase tracking-widest text-sm text-accent/80">{settings.tier2Label}: {group.label}</h2>
                    </>
                  ) : (
                    <>
                      <div className="w-4 h-4" />
                      <h2 className="font-display uppercase tracking-widest text-sm text-muted-foreground/60">Unassigned</h2>
                    </>
                  )}
                  <div className="flex-1 h-px bg-border/30" />
                  <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground border-border/40">
                    {group.squads.length} {group.squads.length === 1 ? settings.tier3Label : settings.tier3LabelPlural}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {group.squads.map(renderCard)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-primary/30">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-widest text-primary flex items-center gap-2">
              <Crosshair className="w-5 h-5" /> {editingId ? `Update ${settings.tier3Label} Directive` : `Establish New ${settings.tier3Label}`}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs uppercase">
              Specify operational parameters for {settings.tier3Label.toLowerCase()} structure.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Unit Designation</FormLabel>
                    <FormControl>
                      <Input placeholder={`E.g. Alpha ${settings.tier3Label}`} className="bg-secondary/50 border-border/50 font-mono" {...field} />
                    </FormControl>
                    <FormMessage className="font-mono text-xs text-destructive" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="level2Id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase text-muted-foreground">
                      {settings.tier2Label} (Optional)
                    </FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))}
                      value={field.value === null || field.value === undefined ? "none" : String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-secondary/50 border-border/50 font-mono text-xs">
                          <SelectValue placeholder={`Select ${settings.tier2Label}`} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-card border-border/50">
                        <SelectItem value="none" className="font-mono text-xs text-muted-foreground">
                          — No {settings.tier2Label} —
                        </SelectItem>
                        {(level2s as any[]).map((l: any) => (
                          <SelectItem key={l.id} value={String(l.id)} className="font-mono text-xs">
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="font-mono text-xs text-destructive" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Mission Statement</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Operational details..." className="bg-secondary/50 border-border/50 font-mono resize-none" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage className="font-mono text-xs text-destructive" />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="font-display uppercase tracking-widest text-xs border-border/50">Abort</Button>
                <Button type="submit" disabled={isCreating || isUpdating} className="font-display uppercase tracking-widest text-xs">
                  {isCreating || isUpdating ? "Processing..." : "Commit"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-destructive/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display uppercase tracking-widest text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Disband {settings.tier3Label}
            </AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-muted-foreground uppercase text-xs">
              Confirm dismantling of this {settings.tier3Label.toLowerCase()}. Assets currently assigned will become unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-display uppercase tracking-widest text-xs border-border/50">Abort</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteSquad({ id: deleteId })}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-display uppercase tracking-widest text-xs"
            >
              {isDeleting ? "Processing..." : "Execute"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
