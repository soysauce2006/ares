import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Settings, Plus, Edit, Trash2, Shield, AlertTriangle, Fingerprint } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser, getListUsersQueryKey, useGetCurrentUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

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
});

export default function Users() {
  const queryClient = useQueryClient();
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: currentUser } = useGetCurrentUser();
  const { data: users, isLoading } = useListUsers();
  
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
    defaultValues: { username: "", email: "", role: "viewer", password: "" },
  });

  const openEditDialog = (user: any) => {
    editForm.reset({
      username: user.username,
      email: user.email,
      role: user.role,
      password: "",
    });
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
      const payload = { ...data };
      if (!payload.password) delete payload.password;
      
      await updateUser({ id: editingUser.id, data: payload as any });
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
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto" />
          <h2 className="text-2xl font-display uppercase tracking-widest text-destructive font-bold">Clearance Level Insufficient</h2>
          <p className="font-mono text-sm text-muted-foreground uppercase">Access to Alpha-level authentication management is restricted to Admin personnel.</p>
        </div>
      </AppLayout>
    );
  }

  const getRoleColor = (role: string) => {
    switch(role) {
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
                  <TableHead className="font-display tracking-widest uppercase text-primary/80">Comms Link (Email)</TableHead>
                  <TableHead className="font-display tracking-widest uppercase text-primary/80">Clearance</TableHead>
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
                      <TableCell><Skeleton className="h-5 w-16 bg-secondary/30" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 bg-secondary/30" /></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))
                ) : users?.map((user) => (
                  <TableRow key={user.id} className="border-border/30 hover:bg-secondary/20 transition-colors">
                    <TableCell className="font-mono font-bold text-foreground">
                      {user.username}
                      {currentUser.id === user.id && <span className="ml-2 text-[10px] text-primary bg-primary/10 px-1 py-0.5 rounded border border-primary/30 uppercase">You</span>}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`font-mono text-[10px] uppercase tracking-widest ${getRoleColor(user.role)}`}>
                        {user.role}
                      </Badge>
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
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEditDialog(user)}>
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* New User Dialog */}
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
              <FormField
                control={newForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Identity</FormLabel>
                    <FormControl>
                      <Input className="bg-secondary/50 border-border/50 font-mono" {...field} />
                    </FormControl>
                    <FormMessage className="font-mono text-xs text-destructive" />
                  </FormItem>
                )}
              />
              <FormField
                control={newForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Comms Link (Email)</FormLabel>
                    <FormControl>
                      <Input type="email" className="bg-secondary/50 border-border/50 font-mono" {...field} />
                    </FormControl>
                    <FormMessage className="font-mono text-xs text-destructive" />
                  </FormItem>
                )}
              />
              <FormField
                control={newForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Initial Passcode</FormLabel>
                    <FormControl>
                      <Input type="password" className="bg-secondary/50 border-border/50 font-mono" {...field} />
                    </FormControl>
                    <FormMessage className="font-mono text-xs text-destructive" />
                  </FormItem>
                )}
              />
              <FormField
                control={newForm.control}
                name="role"
                render={({ field }) => (
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
                )}
              />
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={isCreating} className="w-full font-display uppercase tracking-widest shadow-[0_0_10px_rgba(218,165,32,0.2)]">
                  {isCreating ? "Transmitting..." : "Initialize"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="bg-card border-primary/30 sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-widest text-primary flex items-center gap-2">
              <Settings className="w-5 h-5" /> Modify Protocols
            </DialogTitle>
            <DialogDescription className="font-mono text-xs uppercase">
              Target: {editingUser?.username}
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 pt-4">
              <FormField
                control={editForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Identity</FormLabel>
                    <FormControl>
                      <Input className="bg-secondary/50 border-border/50 font-mono" {...field} />
                    </FormControl>
                    <FormMessage className="font-mono text-xs text-destructive" />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Comms Link (Email)</FormLabel>
                    <FormControl>
                      <Input type="email" className="bg-secondary/50 border-border/50 font-mono" {...field} />
                    </FormControl>
                    <FormMessage className="font-mono text-xs text-destructive" />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
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
                )}
              />
              <FormField
                control={editForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Reset Passcode (Optional)</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Leave blank to keep current" className="bg-secondary/50 border-border/50 font-mono" {...field} />
                    </FormControl>
                    <FormMessage className="font-mono text-xs text-destructive" />
                  </FormItem>
                )}
              />
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
