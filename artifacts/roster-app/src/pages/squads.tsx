import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Crosshair, Plus, Edit, Trash2, AlertTriangle } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useListSquads, useCreateSquad, useUpdateSquad, useDeleteSquad, getListSquadsQueryKey, useGetCurrentUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const squadSchema = z.object({
  name: z.string().min(2, "Name required").max(50),
  description: z.string().optional(),
});

export default function Squads() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: currentUser } = useGetCurrentUser();
  const { data: squads, isLoading } = useListSquads();
  
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
    defaultValues: { name: "", description: "" },
  });

  const openNewDialog = () => {
    form.reset({ name: "", description: "" });
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (squad: any) => {
    form.reset({
      name: squad.name,
      description: squad.description || "",
    });
    setEditingId(squad.id);
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: z.infer<typeof squadSchema>) => {
    try {
      if (editingId) {
        await updateSquad({ id: editingId, data });
        toast({ title: "Unit Updated" });
      } else {
        await createSquad({ data });
        toast({ title: "Unit Established" });
      }
      queryClient.invalidateQueries({ queryKey: getListSquadsQueryKey() });
      setIsDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Operation Failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display uppercase tracking-widest text-foreground font-bold flex items-center gap-3">
              <Crosshair className="w-8 h-8 text-primary" /> Operational Units
            </h1>
            <p className="font-mono text-sm text-muted-foreground mt-1 uppercase">Manage tactical squads and divisions</p>
          </div>
          
          {canManage && (
            <Button onClick={openNewDialog} className="font-display uppercase tracking-widest shadow-[0_0_15px_rgba(218,165,32,0.2)]">
              <Plus className="w-4 h-4 mr-2" /> Form New Unit
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="border-border/40 bg-card/60">
                <CardHeader>
                  <Skeleton className="h-6 w-1/2 bg-secondary/30 mb-2" />
                  <Skeleton className="h-4 w-3/4 bg-secondary/30" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-24 bg-secondary/30" />
                </CardContent>
              </Card>
            ))
          ) : squads?.length === 0 ? (
            <div className="col-span-full py-12 text-center border border-border/30 border-dashed rounded-lg bg-black/10">
              <span className="font-mono text-muted-foreground uppercase tracking-widest">No active operational units.</span>
            </div>
          ) : (
            squads?.map((squad) => (
              <Card key={squad.id} className="border-border/40 bg-card/60 backdrop-blur-md relative overflow-hidden group hover:border-primary/50 transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Crosshair className="w-24 h-24 text-primary" />
                </div>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="font-display text-xl uppercase tracking-widest">{squad.name}</CardTitle>
                    {canManage && (
                      <div className="flex gap-1 z-10 relative">
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
                    <p className="font-mono text-xs text-muted-foreground mt-2 line-clamp-2 h-8">{squad.description}</p>
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
            ))
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-primary/30">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-widest text-primary flex items-center gap-2">
              <Crosshair className="w-5 h-5" /> {editingId ? "Update Unit Directive" : "Establish New Unit"}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs uppercase">
              Specify operational parameters for squad structure.
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
                      <Input placeholder="E.g. Alpha Team" className="bg-secondary/50 border-border/50 font-mono" {...field} />
                    </FormControl>
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
              <AlertTriangle className="w-5 h-5" /> Disband Unit
            </AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-muted-foreground uppercase text-xs">
              Confirm dismantling of this operational unit. Assets currently assigned will become unassigned.
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
