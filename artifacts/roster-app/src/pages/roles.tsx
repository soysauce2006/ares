import React, { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Shield, AlertTriangle, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const PERM_FLAGS = [
  { key: "canManageRoster", label: "Manage Roster", desc: "Create / edit / delete roster members" },
  { key: "canManageOrg", label: "Manage Org Structure", desc: "Squads, ranks, org levels" },
  { key: "canManageChannels", label: "Manage Channels", desc: "Create / manage / delete channels" },
  { key: "canViewActivity", label: "View Activity Logs", desc: "Access the audit log" },
  { key: "canManageUsers", label: "Manage Users", desc: "Create / edit / delete user accounts" },
] as const;

type PermKey = typeof PERM_FLAGS[number]["key"];

type CustomRole = {
  id: number;
  name: string;
  description: string | null;
  color: string;
  canManageRoster: boolean;
  canManageOrg: boolean;
  canManageChannels: boolean;
  canViewActivity: boolean;
  canManageUsers: boolean;
  createdAt: string;
};

const defaultPerms = {
  canManageRoster: false, canManageOrg: false, canManageChannels: false,
  canViewActivity: false, canManageUsers: false,
};

const PRESET_COLORS = [
  "#DAA520", "#6B7280", "#3B82F6", "#10B981", "#EF4444",
  "#8B5CF6", "#F59E0B", "#06B6D4", "#EC4899", "#84CC16",
];

function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`/api${path}`, { credentials: "include", ...opts });
}

async function fetchRoles(): Promise<CustomRole[]> {
  const res = await apiFetch("/roles");
  if (!res.ok) throw new Error("Failed to load roles");
  return res.json();
}

function RoleFormDialog({
  open, onClose, initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: CustomRole | null;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [color, setColor] = useState(initial?.color ?? "#6B7280");
  const [perms, setPerms] = useState<Record<PermKey, boolean>>({
    canManageRoster: initial?.canManageRoster ?? false,
    canManageOrg: initial?.canManageOrg ?? false,
    canManageChannels: initial?.canManageChannels ?? false,
    canViewActivity: initial?.canViewActivity ?? false,
    canManageUsers: initial?.canManageUsers ?? false,
  });
  const [saving, setSaving] = useState(false);

  const isEditing = !!initial;

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const body = { name: name.trim(), description: description.trim() || null, color, ...perms };
      const res = isEditing
        ? await apiFetch(`/roles/${initial!.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await apiFetch("/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Save failed"); }
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast({ title: isEditing ? "Role Updated" : "Role Created", description: `"${name.trim()}" has been ${isEditing ? "updated" : "deployed"}.` });
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-primary/30 sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-widest text-primary flex items-center gap-2">
            <Shield className="w-5 h-5" /> {isEditing ? "Edit Role" : "Create Role"}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs uppercase text-muted-foreground">
            {isEditing ? `Modifying "${initial!.name}"` : "Define a new custom role and assign permissions"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="font-mono text-xs uppercase text-muted-foreground">Role Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Intelligence Officer" className="bg-secondary/50 border-border/50 font-mono" />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="font-mono text-xs uppercase text-muted-foreground">Description (optional)</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description of this role" className="bg-secondary/50 border-border/50 font-mono" />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <label className="font-mono text-xs uppercase text-muted-foreground">Badge Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-7 h-7 rounded-full border-2 transition-all shrink-0",
                    color === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
              <div className="flex items-center gap-1.5 ml-1">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">Custom:</span>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-7 rounded cursor-pointer border border-border/50 bg-transparent" />
              </div>
            </div>
            <div className="mt-1">
              <Badge style={{ backgroundColor: color, color: "#fff", borderColor: color }} className="font-mono text-xs uppercase">
                {name || "Preview"}
              </Badge>
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-2 pt-2 border-t border-border/30">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Permission Grants</p>
            <p className="font-mono text-[9px] text-muted-foreground/60 uppercase">All users assigned this role will inherit these permissions.</p>
            {PERM_FLAGS.map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between gap-3 bg-secondary/20 border border-border/20 rounded px-3 py-2">
                <div className="flex flex-col min-w-0">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-foreground/80">{label}</span>
                  <span className="font-mono text-[9px] text-muted-foreground/60">{desc}</span>
                </div>
                <Switch
                  checked={perms[key]}
                  onCheckedChange={(v) => setPerms(p => ({ ...p, [key]: v }))}
                  className="shrink-0"
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="ghost" onClick={onClose} className="font-mono text-xs uppercase">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="font-display uppercase tracking-widest shadow-[0_0_10px_rgba(218,165,32,0.2)]">
            {saving ? "Saving..." : isEditing ? "Update Role" : "Deploy Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Roles() {
  const { data: currentUser } = useGetCurrentUser();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [deleteRole, setDeleteRole] = useState<CustomRole | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: roles, isLoading } = useQuery<CustomRole[]>({
    queryKey: ["roles"],
    queryFn: fetchRoles,
    enabled: (currentUser as any)?.role === "admin",
  });

  const handleDelete = async () => {
    if (!deleteRole) return;
    setIsDeleting(true);
    try {
      const res = await apiFetch(`/roles/${deleteRole.id}`, { method: "DELETE" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Delete failed"); }
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast({ title: "Role Deleted", description: `"${deleteRole.name}" has been removed.` });
      setDeleteRole(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  if ((currentUser as any)?.role !== "admin") {
    return (
      <AppLayout>
        <div className="p-10 text-center space-y-4 max-w-lg mx-auto mt-20 bg-destructive/10 border border-destructive/30 rounded-lg">
          <Shield className="w-16 h-16 text-destructive mx-auto" />
          <h2 className="text-2xl font-display uppercase tracking-widest text-destructive font-bold">Clearance Level Insufficient</h2>
          <p className="font-mono text-sm text-muted-foreground uppercase">Role management is restricted to Admin personnel.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
              <Shield className="w-8 h-8 text-primary" />
              Command Roles
            </h1>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mt-1">
              Define custom roles and assign permission grants to users
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="font-display uppercase tracking-widest shadow-[0_0_10px_rgba(218,165,32,0.2)]">
            <Plus className="w-4 h-4 mr-2" /> New Role
          </Button>
        </div>

        {/* Roles list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-36 w-full" />)}
          </div>
        ) : !roles || roles.length === 0 ? (
          <Card className="bg-card/50 border-border/30">
            <CardContent className="py-16 text-center space-y-3">
              <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto" />
              <p className="font-display uppercase tracking-widest text-muted-foreground">No custom roles defined</p>
              <p className="font-mono text-xs text-muted-foreground/60 uppercase">Create roles to grant specific permissions to individual users beyond their base clearance level.</p>
              <Button onClick={() => setCreateOpen(true)} variant="outline" className="mt-2 font-mono text-xs uppercase">
                <Plus className="w-3 h-3 mr-1" /> Create First Role
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {roles.map(role => {
              const activePerms = PERM_FLAGS.filter(f => role[f.key]);
              return (
                <Card key={role.id} className="bg-card/60 border-border/30 hover:border-primary/30 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-3 h-3 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: role.color }} />
                        <div className="min-w-0">
                          <CardTitle className="font-display uppercase tracking-widest text-base flex items-center gap-2">
                            <Badge style={{ backgroundColor: role.color, color: "#fff", borderColor: role.color }} className="font-mono text-xs uppercase shrink-0">
                              {role.name}
                            </Badge>
                          </CardTitle>
                          {role.description && (
                            <p className="font-mono text-xs text-muted-foreground mt-1 truncate">{role.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => setEditingRole(role)} className="h-8 px-2 text-muted-foreground hover:text-primary transition-colors">
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteRole(role)} className="h-8 px-2 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {PERM_FLAGS.map(({ key, label }) => {
                        const granted = role[key];
                        return (
                          <div key={key} className={cn(
                            "flex items-center gap-2 px-2.5 py-1.5 rounded border font-mono text-[10px] uppercase tracking-widest",
                            granted
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "bg-secondary/20 border-border/20 text-muted-foreground/40"
                          )}>
                            {granted ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0" />}
                            {label}
                          </div>
                        );
                      })}
                    </div>
                    {activePerms.length === 0 && (
                      <p className="font-mono text-[10px] text-muted-foreground/50 uppercase mt-2">No permissions granted — role is cosmetic only</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <RoleFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {editingRole && (
        <RoleFormDialog open={!!editingRole} onClose={() => setEditingRole(null)} initial={editingRole} />
      )}

      <AlertDialog open={!!deleteRole} onOpenChange={(v) => !v && setDeleteRole(null)}>
        <AlertDialogContent className="bg-card border-destructive/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display uppercase tracking-widest text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Delete Role
            </AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-sm text-muted-foreground">
              Permanently delete <span className="text-foreground font-bold">"{deleteRole?.name}"</span>?
              Users assigned this role will have it removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-mono text-xs uppercase">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/80 font-mono text-xs uppercase"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Role"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
