import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Medal, Plus, Edit, Trash2, ShieldAlert } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useListRanks, useCreateRank, useUpdateRank, useDeleteRank, getListRanksQueryKey, useGetCurrentUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const rankSchema = z.object({
  name: z.string().min(2, "Name required").max(50),
  abbreviation: z.string().min(1, "Abbreviation required").max(10),
  level: z.coerce.number().min(1, "Level must be positive"),
  description: z.string().optional(),
});

export default function Ranks() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: currentUser } = useGetCurrentUser();
  const { data: ranks, isLoading } = useListRanks();
  const { mutateAsync: createRank, isPending: isCreating } = useCreateRank();
  const { mutateAsync: updateRank, isPending: isUpdating } = useUpdateRank();
  const { mutate: deleteRank, isPending: isDeleting } = useDeleteRank({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListRanksQueryKey() });
      toast({ title: "Rank Terminated" });
      setDeleteId(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setDeleteId(null);
    }
  });

  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const form = useForm<z.infer<typeof rankSchema>>({
    resolver: zodResolver(rankSchema),
    defaultValues: { name: "", abbreviation: "", level: 1, description: "" },
  });

  const openNewDialog = () => {
    form.reset({ name: "", abbreviation: "", level: (ranks?.length || 0) + 1, description: "" });
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (rank: any) => {
    form.reset({
      name: rank.name,
      abbreviation: rank.abbreviation,
      level: rank.level,
      description: rank.description || "",
    });
    setEditingId(rank.id);
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: z.infer<typeof rankSchema>) => {
    try {
      if (editingId) {
        await updateRank({ id: editingId, data });
        toast({ title: "Rank Updated" });
      } else {
        await createRank({ data });
        toast({ title: "Rank Created" });
      }
      queryClient.invalidateQueries({ queryKey: getListRanksQueryKey() });
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
              <Medal className="w-8 h-8 text-primary" /> Command Hierarchy
            </h1>
            <p className="font-mono text-sm text-muted-foreground mt-1 uppercase">Manage rank structures and authority levels</p>
          </div>
          
          {canManage && (
            <Button onClick={openNewDialog} className="font-display uppercase tracking-widest shadow-[0_0_15px_rgba(218,165,32,0.2)]">
              <Plus className="w-4 h-4 mr-2" /> Establish Rank
            </Button>
          )}
        </div>

        <Card className="border-border/40 bg-card/60 backdrop-blur-md overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-black/40">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="font-display tracking-widest uppercase text-primary/80 w-24">Level</TableHead>
                  <TableHead className="font-display tracking-widest uppercase text-primary/80">Code</TableHead>
                  <TableHead className="font-display tracking-widest uppercase text-primary/80">Designation</TableHead>
                  <TableHead className="font-display tracking-widest uppercase text-primary/80">Active Personnel</TableHead>
                  {canManage && <TableHead className="text-right font-display tracking-widest uppercase text-primary/80">Override</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i} className="border-border/30">
                      <TableCell><Skeleton className="h-6 w-12 bg-secondary/30" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 bg-secondary/30" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32 bg-secondary/30" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 bg-secondary/30" /></TableCell>
                      {canManage && <TableCell></TableCell>}
                    </TableRow>
                  ))
                ) : ranks?.length === 0 ? (
                  <TableRow className="border-border/30 hover:bg-transparent">
                    <TableCell colSpan={canManage ? 5 : 4} className="h-32 text-center">
                      <span className="font-mono text-muted-foreground uppercase tracking-widest">No hierarchy established.</span>
                    </TableCell>
                  </TableRow>
                ) : (
                  ranks?.sort((a,b) => b.level - a.level).map((rank) => (
                    <TableRow key={rank.id} className="border-border/30 hover:bg-secondary/20 transition-colors group">
                      <TableCell>
                        <div className="w-10 h-10 rounded bg-primary/10 border border-primary/30 flex items-center justify-center font-mono font-bold text-primary shadow-[0_0_10px_rgba(218,165,32,0.1)]">
                          {rank.level}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono font-bold text-foreground text-lg tracking-wider">
                        {rank.abbreviation}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-display font-bold uppercase tracking-wider text-base">{rank.name}</span>
                          {rank.description && <span className="font-mono text-xs text-muted-foreground truncate max-w-xs">{rank.description}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-primary bg-primary/10 px-2 py-1 rounded border border-primary/20">
                          {rank.memberCount || 0}
                        </span>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEditDialog(rank)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/20" onClick={() => setDeleteId(rank.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-primary/30 sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-widest text-primary flex items-center gap-2">
              <Medal className="w-5 h-5" /> {editingId ? "Modify Rank Config" : "Establish Rank"}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs uppercase">
              Enter clearance level parameters. Higher level = greater authority.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Designation</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g. General" className="bg-secondary/50 border-border/50 font-mono" {...field} />
                      </FormControl>
                      <FormMessage className="font-mono text-xs text-destructive" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="abbreviation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Code</FormLabel>
                      <FormControl>
                        <Input placeholder="GEN" className="bg-secondary/50 border-border/50 font-mono uppercase" {...field} />
                      </FormControl>
                      <FormMessage className="font-mono text-xs text-destructive" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Authority Level</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" className="bg-secondary/50 border-border/50 font-mono" {...field} />
                      </FormControl>
                      <FormMessage className="font-mono text-xs text-destructive" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Remarks</FormLabel>
                      <FormControl>
                        <Input className="bg-secondary/50 border-border/50 font-mono" {...field} value={field.value || ''} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="font-display uppercase tracking-widest text-xs">Abort</Button>
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
              <ShieldAlert className="w-5 h-5" /> Warning: Structural Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-muted-foreground uppercase text-xs">
              This will remove the rank from the hierarchy. Personnel currently assigned this rank may be affected. Confirm execution?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-display uppercase tracking-widest text-xs border-border/50">Abort</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteId && deleteRank({ id: deleteId })}
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
