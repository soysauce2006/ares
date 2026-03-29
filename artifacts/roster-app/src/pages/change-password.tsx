import { useState } from "react";
import { useLocation } from "wouter";
import { Shield, Lock, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useChangePassword, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function ChangePasswordPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

  const logout = useLogout({
    mutation: {
      onSettled: () => {
        queryClient.clear();
        setLocation("/login");
      },
    },
  });

  const changePassword = useChangePassword({
    mutation: {
      onSuccess: () => {
        logout.mutate();
      },
      onError: (err: any) => {
        setError(err?.message || "Failed to change password");
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    changePassword.mutate({ data: { newPassword } });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,200,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,200,0,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />

      <div className="relative w-full max-w-md">
        <div className="border border-primary/40 bg-card rounded-sm p-8 shadow-2xl shadow-primary/10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-primary/20 rounded-sm flex items-center justify-center mb-4 border border-primary/40">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground tracking-widest uppercase">
              Security Update Required
            </h1>
            <p className="text-muted-foreground text-sm font-mono tracking-wider text-center mt-2">
              You must set a new password before continuing
            </p>
          </div>

          <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-sm p-3 mb-6">
            <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
            <p className="text-yellow-400 text-xs font-mono leading-relaxed">
              This account was issued with a temporary password. Choose a strong, unique password to secure your access.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono tracking-widest text-muted-foreground mb-2 uppercase">
                <Lock className="inline w-3 h-3 mr-1" /> New Password
              </label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-background border border-border text-foreground font-mono px-4 py-3 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary pr-10"
                  placeholder="Enter new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono tracking-widest text-muted-foreground mb-2 uppercase">
                <Lock className="inline w-3 h-3 mr-1" /> Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-background border border-border text-foreground font-mono px-4 py-3 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary pr-10"
                  placeholder="Confirm new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm font-mono bg-destructive/10 border border-destructive/30 rounded-sm px-3 py-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={changePassword.isPending}
              className="w-full bg-primary text-primary-foreground font-display font-bold tracking-widest text-sm py-3 px-6 rounded-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors uppercase mt-2"
            >
              {changePassword.isPending ? "UPDATING..." : "SET NEW PASSWORD"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
