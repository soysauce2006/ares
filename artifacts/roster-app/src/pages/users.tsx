import React, { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Settings, Plus, Edit, Trash2, Shield, AlertTriangle, Fingerprint, Lock, ChevronRight, ChevronDown, Check, ShieldOff } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useListUsers, useCreateUser, useUpdateUser, useDeleteUser, getListUsersQueryKey,
  useGetCurrentUser, useGetUserAccess, useSetUserAccess, getGetUserAccessQueryKey,
  useListOrgLevel1, useListOrgLevel2, useListSquads, useListClearances,
} from "@workspace/api-client-react";
import { ClearanceBadge } from "@/pages/clearances";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useSettings } from "@/contexts/settings-context";
import { cn } from "@/lib/utils";

const createUserSchema = z.object({
  username: z.string().min(2, "Username required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Password must be at least 6 chars"),
  role: z.enum(["admin", "manager", "viewer"]),
});

const updateUserSchema = z.object({
  username: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(["admin", "manager", "viewer"]).optional(),
  password: z.string().optional().or(z.literal('')),
  clearanceId: z.coerce.number().nullable().optional(),
});

type GrantEntry = { grantType: "level1" | "level2" | "squad"; grantId: number };

function AccessDialog({ user, onClose }: { user: any; onClose: () => void }) {
  const settings = useSettings();
  const queryClient = useQueryClient();

  const { data: currentGrants, isLoading: isLoadingGrants } = useGetUserAccess(user.id);
  const { data: level1s } = useListOrgLevel1();
  const { data: level2s } = useListOrgLevel2();
  const { data: squads } = useListSquads();
  const { mutateAsync: setAccess, isPending: isSaving } = useSetUserAccess();

  const [unrestricted, setUnrestricted] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentGrants) return;
    setUnrestricted(currentGrants.unrestricted);
    const keys = new Set<string>();
    for (const g of currentGrants.grants) {
      keys.add(`${g.grantType}:${g.grantId}`);
    }
    setSelected(keys);
    const expanded = new Set<string>();
    if (level1s) {
      for (const l1 of level1s) {
        const hasL2Grant = currentGrants.grants.some(g => {
          if (g.grantType === "level1" && g.grantId === l1.id) return true;
          const l2 = level2s?.find(l => l.id === g.grantId);
          if (g.grantType === "level2" && l2?.level1Id === l1.id) return true;
          const sq = squads?.find(s => s.id === g.grantId);
          if (g.grantType === "squad") {
            const l2Sq = level2s?.find(l => l.id === sq?.level2Id);
            if (l2Sq?.level1Id === l1.id) return true;
          }
          return false;
        });
        if (hasL2Grant) expanded.add(`level1:${l1.id}`);
      }
    }
    setExpanded(expanded);
  }, [currentGrants, level1s, level2s, squads]);

  const toggleExpand = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isChecked = (key: string) => selected.has(key);

  const toggleGrant = (key: string, type: "level1" | "level2" | "squad", id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isLevel1Partial = (l1Id: number) => {
    const l2sUnder = level2s?.filter(l => l.level1Id === l1Id) ?? [];
    const squadsUnder = squads?.filter(s => l2sUnder.some(l => l.id === s.level2Id)) ?? [];
    const l2Keys = l2sUnder.map(l => `level2:${l.id}`);
    const sqKeys = squadsUnder.map(s => `squad:${s.id}`);
    const allKeys = [`level1:${l1Id}`, ...l2Keys, ...sqKeys];
    const someSelected = allKeys.some(k => selected.has(k));
    const allSelected = allKeys.length > 0 && allKeys.every(k => selected.has(k));
    return someSelected && !allSelected;
  };

  const handleSave = async () => {
    const grants: GrantEntry[] = unrestricted
      ? []
      : Array.from(selected).map(key => {
          const [type, idStr] = key.split(":");
          return { grantType: type as "level1" | "level2" | "squad", grantId: parseInt(idStr) };
        });
    try {
      await setAccess({ id: user.id, data: { grants, unrestricted } as any });
      queryClient.invalidateQueries({ queryKey: getGetUserAccessQueryKey(user.id) });
      toast({ title: "Sector Access Updated", description: `Access zones reconfigured for ${user.username}.` });
      onClose();
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card border-primary/30 sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-widest text-primary flex items-center gap-2">
            <Lock className="w-5 h-5" /> Sector Access Control
          </DialogTitle>
          <DialogDescription className="font-mono text-xs uppercase text-muted-foreground">
            Target: <span className="text-foreground">{user.username}</span> — Define which org units this user can access.
          </DialogDescription>
        </DialogHeader>

        {isLoadingGrants ? (
          <div className="space-y-2 py-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 bg-secondary/30" />)}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between bg-secondary/30 rounded-lg px-4 py-3 border border-border/40">
              <div>
                <Label className="font-display uppercase tracking-widest text-sm text-foreground">Unrestricted Access</Label>
                <p className="font-mono text-[10px] text-muted-foreground uppercase mt-0.5">User can see all org units and roster entries</p>
              </div>
              <Switch
                checked={unrestricted}
                onCheckedChange={setUnrestricted}
                className="data-[state=checked]:bg-primary"
              />
            </div>

            {!unrestricted && (
              <div>
                <p className="font-mono text-[10px] uppercase text-muted-foreground mb-2 pl-1">Select accessible org units:</p>
                <ScrollArea className="h-64 rounded-lg border border-border/40 bg-black/20">
                  <div className="p-2 space-y-0.5">
                    {level1s?.length === 0 && (
                      <p className="text-center text-muted-foreground font-mono text-xs uppercase py-8">No org units defined</p>
                    )}
                    {level1s?.map(l1 => {
                      const l1Key = `level1:${l1.id}`;
                      const l1Expanded = expanded.has(l1Key);
                      const l2sForL1 = level2s?.filter(l => l.level1Id === l1.id) ?? [];
                      const partial = isLevel1Partial(l1.id);

                      return (
                        <div key={l1.id}>
                          <div className="flex items-center gap-1 group">
                            <button
                              onClick={() => toggleExpand(l1Key)}
                              className="p-1 text-muted-foreground hover:text-primary transition-colors"
                            >
                              {l1Expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </button>
                            <button
                              onClick={() => toggleGrant(l1Key, "level1", l1.id)}
                              className={cn(
                                "flex items-center gap-2 flex-1 px-2 py-1.5 rounded text-left transition-colors hover:bg-secondary/30",
                                isChecked(l1Key) ? "text-primary" : partial ? "text-accent" : "text-foreground"
                              )}
                            >
                              <div className={cn(
                                "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0",
                                isChecked(l1Key) ? "bg-primary border-primary" : partial ? "border-accent" : "border-border"
                              )}>
                                {isChecked(l1Key) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                                {!isChecked(l1Key) && partial && <div className="w-1.5 h-0.5 bg-accent" />}
                              </div>
                              <span className="font-display uppercase tracking-wider text-xs">{l1.name}</span>
                              <Badge variant="outline" className="ml-auto text-[9px] font-mono text-primary/60 border-primary/20 uppercase">
                                {settings.tier1Label}
                              </Badge>
                            </button>
                          </div>

                          {l1Expanded && l2sForL1.map(l2 => {
                            const l2Key = `level2:${l2.id}`;
                            const squadsForL2 = squads?.filter(s => s.level2Id === l2.id) ?? [];

                            return (
                              <div key={l2.id} className="pl-7">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => toggleExpand(l2Key)}
                                    className="p-1 text-muted-foreground hover:text-primary transition-colors"
                                  >
                                    {expanded.has(l2Key) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                  </button>
                                  <button
                                    onClick={() => toggleGrant(l2Key, "level2", l2.id)}
                                    className={cn(
                                      "flex items-center gap-2 flex-1 px-2 py-1.5 rounded text-left transition-colors hover:bg-secondary/30",
                                      isChecked(l2Key) ? "text-primary" : "text-foreground/80"
                                    )}
                                  >
                                    <div className={cn(
                                      "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0",
                                      isChecked(l2Key) ? "bg-primary border-primary" : "border-border/60"
                                    )}>
                                      {isChecked(l2Key) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                                    </div>
                                    <span className="font-display uppercase tracking-wider text-xs">{l2.name}</span>
                                    <Badge variant="outline" className="ml-auto text-[9px] font-mono text-accent/60 border-accent/20 uppercase">
                                      {settings.tier2Label}
                                    </Badge>
                                  </button>
                                </div>

                                {expanded.has(l2Key) && squadsForL2.map(sq => {
                                  const sqKey = `squad:${sq.id}`;
                                  return (
                                    <div key={sq.id} className="pl-7">
                                      <button
                                        onClick={() => toggleGrant(sqKey, "squad", sq.id)}
                                        className={cn(
                                          "flex items-center gap-2 w-full px-2 py-1.5 rounded text-left transition-colors hover:bg-secondary/30",
                                          isChecked(sqKey) ? "text-primary" : "text-foreground/60"
                                        )}
                                      >
                                        <div className={cn(
                                          "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0",
                                          isChecked(sqKey) ? "bg-primary border-primary" : "border-border/40"
                                        )}>
                                          {isChecked(sqKey) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                                        </div>
                                        <span className="font-mono text-xs">{sq.name}</span>
                                        <Badge variant="outline" className="ml-auto text-[9px] font-mono text-muted-foreground/50 border-border/20 uppercase">
                                          {settings.tier3Label}
                                        </Badge>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                {!unrestricted && (
                  <p className="font-mono text-[9px] text-muted-foreground/50 uppercase mt-1 pl-1">
                    Grants are additive — selecting a {settings.tier1Label} grants access to all its children.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="font-display uppercase tracking-widest text-xs border-border/50">
            Abort
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="font-display uppercase tracking-widest shadow-[0_0_10px_rgba(218,165,32,0.2)]">
            {isSaving ? "Transmitting..." : "Deploy Access Config"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Users() {
  const queryClient = useQueryClient();
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [accessUser, setAccessUser] = useState<any>(null);

  const { data: currentUser } = useGetCurrentUser();
  const { data: users, isLoading } = useListUsers();
  const { data: clearances } = useListClearances();

  const { mutateAsync: createUser, isPending: isCreating } = useCreateUser();
  const { mutateAsync: updateUser, isPending: isUpdating } = useUpdateUser();
  const { mutate: deleteUser, isPending: isDeleting } = useDeleteUser({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      toast({ title: "Auth Revoked", description: "User account has been terminated." });
      setDeleteId(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setDeleteId(null);
    }
  });

  const newForm = useForm<z.infer<typeof createUserSchema>>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { username: "", email: "", password: "", role: "viewer" },
  });

  const editForm = useForm<z.infer<typeof updateUserSchema>>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { username: "", email: "", role: "viewer", password: "", clearanceId: null },
  });

  const openEditDialog = (user: any) => {
    editForm.reset({ username: user.username, email: user.email, role: user.role, password: "", clearanceId: user.clearanceId ?? null });
    setEditingUser(user);
  };

  const onNewSubmit = async (data: z.infer<typeof createUserSchema>) => {
    try {
      await createUser({ data });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      toast({ title: "Clearance Granted", description: "New system account provisioned." });
      setIsNewDialogOpen(false);
      newForm.reset();
    } catch (err: any) {
      toast({ title: "Provisioning Failed", description: err.message, variant: "destructive" });
    }
  };

  const onEditSubmit = async (data: z.infer<typeof updateUserSchema>) => {
    try {
      const payload: any = { ...data };
      if (!payload.password) delete payload.password;
      // clearanceId: pass null to unset, number to set
      if (payload.clearanceId === "" || payload.clearanceId === undefined) delete payload.clearanceId;
      await updateUser({ id: editingUser.id, data: payload });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      toast({ title: "Auth Modified", description: "Account protocols updated." });
      setEditingUser(null);
    } catch (err: any) {
      toast({ title: "Modification Failed", description: err.message, variant: "destructive" });
    }
  };

  if (currentUser?.role !== 'admin') {
    return (
      <AppLayout>
        <div className="p-10 text-center space-y-4 max-w-lg mx-auto mt-20 bg-destructive/10 border border-destructive/30 rounded-lg">
          <Shield className="w-16 h-16 text-destructive mx-auto" />
          <h2 className="text-2xl font-display uppercase tracking-widest text-destructive font-bold">Clearance Level Insufficient</h2>
          <p className="font-mono text-sm text-muted-foreground uppercase">Access to Alpha-level authentication management is restricted to Admin personnel.</p>
        </div>
      </AppLayout>
    );
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'text-primary border-primary bg-primary/10';
      case 'manager': return 'text-accent border-accent bg-accent/10';
      default: return 'text-muted-foreground border-border bg-secondary';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display uppercase tracking-widest text-foreground font-bold flex items-center gap-3">
              <Settings className="w-8 h-8 text-primary" /> Personnel Auth
            </h1>
            <p className="font-mono text-sm text-muted-foreground mt-1 uppercase">Manage system access and permissions</p>
          </div>
          <Button onClick={() => setIsNewDialogOpen(true)} className="font-display uppercase tracking-widest shadow-[0_0_15px_rgba(218,165,32,0.2)]">
            <Plus className="w-4 h-4 mr-2" /> Provision Account
          </Button>
        </div>

        <Card className="border-border/40 bg-card/60 backdrop-blur-md overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-black/40">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="font-display tracking-widest uppercase text-primary/80">Identity</TableHead>
                  <TableHead className="font-display tracking-widest uppercase text-primary/80">Comms Link</TableHead>
                  <TableHead className="font-display tracking-widest uppercase text-primary/80">Role</TableHead>
                  <TableHead className="font-display tracking-widest uppercase text-primary/80">Clearance Rank</TableHead>
                  <TableHead className="font-display tracking-widest uppercase text-primary/80">Security</TableHead>
                  <TableHead className="font-display tracking-widest uppercase text-primary/80">Last Uplink</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i} className="border-border/30">
                      <TableCell><Skeleton className="h-5 w-24 bg-secondary/30" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-48 bg-secondary/30" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded bg-secondary/30" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-28 rounded bg-secondary/30" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 bg-secondary/30" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 bg-secondary/30" /></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))
                ) : users?.map((user) => (
                  <TableRow key={user.id} className="border-border/30 hover:bg-secondary/20 transition-colors">
                    <TableCell className="font-mono font-bold text-foreground">
                      {user.username}
                      {currentUser.id === user.id && (
                        <span className="ml-2 text-[10px] text-primary bg-primary/10 px-1 py-0.5 rounded border border-primary/30 uppercase">You</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`font-mono text-[10px] uppercase tracking-widest ${getRoleColor(user.role)}`}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(user as any).clearanceName ? (
                        <ClearanceBadge
                          name={(user as any).clearanceName}
                          color={(user as any).clearanceColor ?? "amber"}
                          level={(user as any).clearanceLevel}
                        />
                      ) : (
                        <span className="text-muted-foreground/40 text-xs font-mono uppercase">Unclassified</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.mfaEnabled ? (
                        <div className="flex items-center gap-1 text-primary text-xs font-mono uppercase">
                          <Fingerprint className="w-3 h-3" /> Enabled
                        </div>
                      ) : (
                        <span className="text-muted-foreground/50 text-xs font-mono uppercase">Standard</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {user.lastLogin ? format(new Date(user.lastLogin), "yyyy-MM-dd HH:mm") : 'NEVER'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-accent hover:bg-accent/10"
                          title="Sector Access Control"
                          onClick={() => setAccessUser(user)}
                        >
                          <Lock className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => openEditDialog(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/20 disabled:opacity-30"
                          onClick={() => setDeleteId(user.id)}
                          disabled={currentUser.id === user.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {accessUser && <AccessDialog user={accessUser} onClose={() => setAccessUser(null)} />}

      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent className="bg-card border-primary/30 sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-widest text-primary flex items-center gap-2">
              <Shield className="w-5 h-5" /> Provision Account
            </DialogTitle>
            <DialogDescription className="font-mono text-xs uppercase">
              Establish secure credentials for new command personnel.
            </DialogDescription>
          </DialogHeader>
          <Form {...newForm}>
            <form onSubmit={newForm.handleSubmit(onNewSubmit)} className="space-y-4 pt-4">
              <FormField control={newForm.control} name="username" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Identity</FormLabel>
                  <FormControl><Input className="bg-secondary/50 border-border/50 font-mono" {...field} /></FormControl>
                  <FormMessage className="font-mono text-xs text-destructive" />
                </FormItem>
              )} />
              <FormField control={newForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Comms Link (Email)</FormLabel>
                  <FormControl><Input type="email" className="bg-secondary/50 border-border/50 font-mono" {...field} /></FormControl>
                  <FormMessage className="font-mono text-xs text-destructive" />
                </FormItem>
              )} />
              <FormField control={newForm.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Initial Passcode</FormLabel>
                  <FormControl><Input type="password" className="bg-secondary/50 border-border/50 font-mono" {...field} /></FormControl>
                  <FormMessage className="font-mono text-xs text-destructive" />
                </FormItem>
              )} />
              <FormField control={newForm.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Clearance Level</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-secondary/50 border-border/50 font-mono text-xs uppercase">
                        <SelectValue placeholder="Select clearance" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-card border-border/50 font-mono text-xs uppercase">
                      <SelectItem value="admin">Alpha (Admin)</SelectItem>
                      <SelectItem value="manager">Beta (Manager)</SelectItem>
                      <SelectItem value="viewer">Gamma (Viewer)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="font-mono text-xs text-destructive" />
                </FormItem>
              )} />
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={isCreating} className="w-full font-display uppercase tracking-widest shadow-[0_0_10px_rgba(218,165,32,0.2)]">
                  {isCreating ? "Transmitting..." : "Initialize"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="bg-card border-primary/30 sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-widest text-primary flex items-center gap-2">
              <Settings className="w-5 h-5" /> Modify Protocols
            </DialogTitle>
            <DialogDescription className="font-mono text-xs uppercase">Target: {editingUser?.username}</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 pt-4">
              <FormField control={editForm.control} name="username" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Identity</FormLabel>
                  <FormControl><Input className="bg-secondary/50 border-border/50 font-mono" {...field} /></FormControl>
                  <FormMessage className="font-mono text-xs text-destructive" />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Comms Link (Email)</FormLabel>
                  <FormControl><Input type="email" className="bg-secondary/50 border-border/50 font-mono" {...field} /></FormControl>
                  <FormMessage className="font-mono text-xs text-destructive" />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Clearance Level</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-secondary/50 border-border/50 font-mono text-xs uppercase">
                        <SelectValue placeholder="Select clearance" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-card border-border/50 font-mono text-xs uppercase">
                      <SelectItem value="admin">Alpha (Admin)</SelectItem>
                      <SelectItem value="manager">Beta (Manager)</SelectItem>
                      <SelectItem value="viewer">Gamma (Viewer)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="font-mono text-xs text-destructive" />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="clearanceId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Clearance Rank</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))}
                    value={field.value === null || field.value === undefined ? "none" : String(field.value)}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-secondary/50 border-border/50 font-mono text-xs uppercase">
                        <SelectValue placeholder="No clearance assigned" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-card border-border/50">
                      <SelectItem value="none" className="font-mono text-xs uppercase text-muted-foreground">
                        — Unclassified —
                      </SelectItem>
                      {clearances?.map(c => (
                        <SelectItem key={c.id} value={String(c.id)} className="font-mono text-xs uppercase">
                          L{c.level} — {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="font-mono text-xs text-destructive" />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Reset Passcode (Optional)</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Leave blank to keep current" className="bg-secondary/50 border-border/50 font-mono" {...field} />
                  </FormControl>
                  <FormMessage className="font-mono text-xs text-destructive" />
                </FormItem>
              )} />
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={isUpdating} className="w-full font-display uppercase tracking-widest shadow-[0_0_10px_rgba(218,165,32,0.2)]">
                  {isUpdating ? "Overwriting..." : "Apply Protocols"}
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
              <AlertTriangle className="w-5 h-5" /> Revoke Authorization
            </AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-muted-foreground uppercase text-xs">
              This will permanently delete the system account and lock the user out of the command center.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-display uppercase tracking-widest text-xs border-border/50">Abort</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteUser({ id: deleteId })}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-display uppercase tracking-widest text-xs"
            >
              {isDeleting ? "Processing..." : "Revoke Access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
