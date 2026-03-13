import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Shield, Plus, Edit, Trash2, AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  useListClearances, useCreateClearance, useUpdateClearance, useDeleteClearance,
  getListClearancesQueryKey, useGetCurrentUser
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const COLOR_OPTIONS = [
  { value: "amber", label: "Gold", textClass: "text-amber-400", bgClass: "bg-amber-400/10 border-amber-400/30", dotClass: "bg-amber-400" },
  { value: "red", label: "Red", textClass: "text-red-400", bgClass: "bg-red-400/10 border-red-400/30", dotClass: "bg-red-400" },
  { value: "orange", label: "Orange", textClass: "text-orange-400", bgClass: "bg-orange-400/10 border-orange-400/30", dotClass: "bg-orange-400" },
  { value: "green", label: "Green", textClass: "text-green-400", bgClass: "bg-green-400/10 border-green-400/30", dotClass: "bg-green-400" },
  { value: "blue", label: "Blue", textClass: "text-blue-400", bgClass: "bg-blue-400/10 border-blue-400/30", dotClass: "bg-blue-400" },
  { value: "violet", label: "Violet", textClass: "text-violet-400", bgClass: "bg-violet-400/10 border-violet-400/30", dotClass: "bg-violet-400" },
  { value: "gray", label: "Gray", textClass: "text-gray-400", bgClass: "bg-gray-400/10 border-gray-400/30", dotClass: "bg-gray-400" },
];

export function getClearanceColor(color: string) {
  return COLOR_OPTIONS.find(c => c.value === color) ?? COLOR_OPTIONS[0];
}

export function ClearanceBadge({ name, color, level }: { name: string; color: string; level?: number | null }) {
  const c = getClearanceColor(color);
  return (
    <Badge variant="outline" className={cn("font-mono text-[10px] uppercase tracking-widest", c.textClass, c.bgClass)}>
      {level != null && <span className="mr-1 opacity-60">L{level}</span>}
      {name}
    </Badge>
  );
}

const clearanceSchema = z.object({
  name: z.string().min(2, "Name required").max(60),
  level: z.coerce.number().int().min(0, "Level must be 0 or higher"),
  description: z.string().optional(),
  color: z.string().default("amber"),
});

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLOR_OPTIONS.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-mono uppercase tracking-wider transition-all",
            opt.textClass,
            value === opt.value ? `${opt.bgClass} ring-1 ring-current` : "border-border/40 bg-secondary/20 hover:bg-secondary/40 text-muted-foreground"
          )}
        >
          <span className={cn("w-2 h-2 rounded-full", opt.dotClass)} />
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function Clearances() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: currentUser } = useGetCurrentUser();
  const { data: clearances, isLoading } = useListClearances();
  const { mutateAsync: createClearance, isPending: isCreating } = useCreateClearance();
  const { mutateAsync: updateClearance, isPending: isUpdating } = useUpdateClearance();
  const { mutate: deleteClearance, isPending: isDeleting } = useDeleteClearance({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListClearancesQueryKey() });
      toast({ title: "Clearance Decommissioned", description: "Security clearance level removed." });
      setDeleteId(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setDeleteId(null);
    }
  });

  const form = useForm<z.infer<typeof clearanceSchema>>({
    resolver: zodResolver(clearanceSchema),
    defaultValues: { name: "", level: 1, description: "", color: "amber" },
  });

  const openNew = () => {
    form.reset({ name: "", level: (clearances?.length ?? 0) + 1, description: "", color: "amber" });
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const openEdit = (c: any) => {
    form.reset({
      name: c.name,
      level: c.level,
      description: c.description ?? "",
      color: c.color ?? "amber",
    });
    setEditingId(c.id);
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: z.infer<typeof clearanceSchema>) => {
    try {
      if (editingId !== null) {
        await updateClearance({ id: editingId, data: data as any });
        toast({ title: "Clearance Updated", description: `"${data.name}" protocols updated.` });
      } else {
        await createClearance({ data: data as any });
        toast({ title: "Clearance Established", description: `"${data.name}" clearance level added.` });
      }
      queryClient.invalidateQueries({ queryKey: getListClearancesQueryKey() });
      setIsDialogOpen(false);
      form.reset();
    } catch (err: any) {
      toast({ title: "Operation Failed", description: err.message, variant: "destructive" });
    }
  };

  if (currentUser?.role !== "admin") {
    return (
      <AppLayout>
        <div className="p-10 text-center space-y-4 max-w-lg mx-auto mt-20 bg-destructive/10 border border-destructive/30 rounded-lg">
          <Shield className="w-16 h-16 text-destructive mx-auto" />
          <h2 className="text-2xl font-display uppercase tracking-widest text-destructive font-bold">Clearance Level Insufficient</h2>
          <p className="font-mono text-sm text-muted-foreground uppercase">Clearance rank management is restricted to Alpha-level personnel.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display uppercase tracking-widest text-foreground font-bold flex items-center gap-3">
              <Shield className="w-8 h-8 text-primary" /> Clearance Ranks
            </h1>
            <p className="font-mono text-sm text-muted-foreground mt-1 uppercase">Define and manage security clearance levels for personnel</p>
          </div>
          <Button onClick={openNew} className="font-display uppercase tracking-widest shadow-[0_0_15px_rgba(218,165,32,0.2)]">
            <Plus className="w-4 h-4 mr-2" /> Define Clearance
          </Button>
        </div>

        {clearances && clearances.length === 0 && !isLoading && (
          <Card className="border-border/40 bg-card/60 backdrop-blur-md p-12 text-center">
            <Shield className="w-12 h-12 text-primary/30 mx-auto mb-4" />
            <p className="font-display uppercase tracking-widest text-muted-foreground">No clearance levels defined</p>
            <p className="font-mono text-xs text-muted-foreground/60 mt-2 uppercase">Create your first security clearance rank to assign to personnel</p>
            <Button onClick={openNew} variant="outline" className="mt-6 font-display uppercase tracking-widest border-primary/30 hover:bg-primary/10">
              <Plus className="w-4 h-4 mr-2" /> Define First Clearance
            </Button>
          </Card>
        )}

        {(isLoading || (clearances && clearances.length > 0)) && (
          <Card className="border-border/40 bg-card/60 backdrop-blur-md overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-black/40">
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="font-display tracking-widest uppercase text-primary/80 w-20">Level</TableHead>
                    <TableHead className="font-display tracking-widest uppercase text-primary/80">Designation</TableHead>
                    <TableHead className="font-display tracking-widest uppercase text-primary/80">Color Code</TableHead>
                    <TableHead className="font-display tracking-widest uppercase text-primary/80">Description</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i} className="border-border/30">
                        <TableCell><Skeleton className="h-5 w-8 bg-secondary/30" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-32 bg-secondary/30" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20 bg-secondary/30" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-48 bg-secondary/30" /></TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    ))
                  ) : clearances?.map((c) => {
                    const colorOpt = getClearanceColor(c.color);
                    return (
                      <TableRow key={c.id} className="border-border/30 hover:bg-secondary/20 transition-colors">
                        <TableCell>
                          <div className={cn(
                            "w-10 h-10 rounded-lg border flex items-center justify-center font-display font-bold text-sm",
                            colorOpt.bgClass, colorOpt.textClass
                          )}>
                            {c.level}
                          </div>
                        </TableCell>
                        <TableCell>
                          <ClearanceBadge name={c.name} color={c.color} level={c.level} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={cn("w-3 h-3 rounded-full", colorOpt.dotClass)} />
                            <span className="font-mono text-xs text-muted-foreground uppercase">{colorOpt.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground max-w-xs truncate">
                          {c.description ?? <span className="text-muted-foreground/40 italic">No description</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => openEdit(c)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/20"
                              onClick={() => setDeleteId(c.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={open => { if (!open) { setIsDialogOpen(false); form.reset(); } }}>
        <DialogContent className="bg-card border-primary/30 sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-widest text-primary flex items-center gap-2">
              <Shield className="w-5 h-5" /> {editingId !== null ? "Modify Clearance" : "Define Clearance"}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs uppercase">
              {editingId !== null ? "Update clearance rank designation and color code." : "Establish a new security clearance rank level."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem className="col-span-2 sm:col-span-1">
                    <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Designation</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Top Secret" className="bg-secondary/50 border-border/50 font-mono" {...field} />
                    </FormControl>
                    <FormMessage className="font-mono text-xs text-destructive" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="level" render={({ field }) => (
                  <FormItem className="col-span-2 sm:col-span-1">
                    <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Security Level</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" className="bg-secondary/50 border-border/50 font-mono" {...field} />
                    </FormControl>
                    <FormMessage className="font-mono text-xs text-destructive" />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Details about this clearance level..."
                      className="bg-secondary/50 border-border/50 font-mono text-sm resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="font-mono text-xs text-destructive" />
                </FormItem>
              )} />
              <FormField control={form.control} name="color" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Color Code</FormLabel>
                  <FormControl>
                    <ColorPicker value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage className="font-mono text-xs text-destructive" />
                </FormItem>
              )} />
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={isCreating || isUpdating} className="w-full font-display uppercase tracking-widest shadow-[0_0_10px_rgba(218,165,32,0.2)]">
                  {(isCreating || isUpdating) ? "Transmitting..." : editingId !== null ? "Update Clearance" : "Establish Clearance"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-destructive/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display uppercase tracking-widest text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Decommission Clearance
            </AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-muted-foreground uppercase text-xs">
              This will permanently delete the clearance level. Personnel assigned this clearance will be reverted to "Unclassified".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-display uppercase tracking-widest text-xs border-border/50">Abort</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteClearance({ id: deleteId })}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-display uppercase tracking-widest text-xs"
            >
              {isDeleting ? "Processing..." : "Decommission"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
