import React, { useState } from "react";
import { Link } from "wouter";
import { User, Shield, Fingerprint, Lock, CheckCircle2 } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGetCurrentUser, useUpdateUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Profile() {
  const queryClient = useQueryClient();
  const { data: user } = useGetCurrentUser();
  const { mutateAsync: updateUser, isPending } = useUpdateUser();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || newPassword.length < 6) {
      toast({ title: "Invalid Password", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Mismatch", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    try {
      await updateUser({ id: user.id, data: { password: newPassword } });
      toast({ title: "Credentials Updated", description: "Password changed successfully." });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    }
  };

  if (!user) return null;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-display uppercase tracking-widest text-foreground font-bold flex items-center gap-3">
            <User className="w-8 h-8 text-primary" /> Operative Dossier
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-1 uppercase">Your profile and security settings</p>
        </div>

        {/* Profile Info */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-md">
          <CardHeader className="border-b border-border/30 bg-black/20">
            <CardTitle className="font-display uppercase tracking-widest text-primary flex items-center gap-2">
              <Shield className="w-4 h-4" /> Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">Username</p>
                <p className="font-bold text-foreground">{user.username}</p>
              </div>
              <div>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">Email</p>
                <p className="font-bold text-foreground">{user.email}</p>
              </div>
              <div>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">Clearance Level</p>
                <Badge variant="outline" className="font-mono text-[10px] uppercase bg-primary/10 text-primary border-primary/30">
                  {user.role}
                </Badge>
              </div>
              <div>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">Account Since</p>
                <p className="font-mono text-sm text-foreground">{format(new Date(user.createdAt), "yyyy-MM-dd")}</p>
              </div>
              {user.lastLogin && (
                <div className="col-span-2">
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">Last Active</p>
                  <p className="font-mono text-sm text-foreground">{format(new Date(user.lastLogin), "yyyy-MM-dd HH:mm:ss")} Z</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* MFA Status */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-md">
          <CardHeader className="border-b border-border/30 bg-black/20">
            <CardTitle className="font-display uppercase tracking-widest text-primary flex items-center gap-2">
              <Fingerprint className="w-4 h-4" /> Level 2 Authentication
            </CardTitle>
            <CardDescription className="font-mono text-xs uppercase">Multi-factor authentication status</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {user.mfaEnabled ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-bold text-foreground">Protocol Active</p>
                      <p className="text-xs font-mono text-muted-foreground uppercase">Level 2 authentication is enabled</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-bold text-foreground">Protocol Inactive</p>
                      <p className="text-xs font-mono text-muted-foreground uppercase">Enable MFA to secure your account</p>
                    </div>
                  </>
                )}
              </div>
              {!user.mfaEnabled && (
                <Button asChild className="font-display uppercase tracking-widest text-xs">
                  <Link href="/setup-mfa">Enable MFA</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-md">
          <CardHeader className="border-b border-border/30 bg-black/20">
            <CardTitle className="font-display uppercase tracking-widest text-primary flex items-center gap-2">
              <Lock className="w-4 h-4" /> Change Passcode
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">New Password</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-secondary/50 border-border/50 font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Confirm Password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-secondary/50 border-border/50 font-mono"
                />
              </div>
              <Button type="submit" disabled={isPending || !newPassword} className="font-display uppercase tracking-widest text-xs">
                {isPending ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
