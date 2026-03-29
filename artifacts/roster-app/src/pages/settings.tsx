import { useState, useEffect, useRef, useCallback } from "react";
import { Shield, Save, RotateCcw, Settings as SettingsIcon, Upload, X, Image as ImageIcon, GitBranch, RefreshCw, Download, Copy, CheckCircle, AlertCircle, Terminal } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey, useGetCurrentUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const TEXT_DEFAULTS = {
  siteName: "A.R.E.S.",
  siteSubtitle: "Advanced Roster Execution System",
  tier1Label: "Division",
  tier1LabelPlural: "Divisions",
  tier2Label: "Company",
  tier2LabelPlural: "Companies",
  tier3Label: "Squad",
  tier3LabelPlural: "Squads",
  roleLabelAdmin: "Admin",
  roleLabelManager: "Manager",
  roleLabelViewer: "Viewer",
};

const IMAGE_SLOTS = [
  {
    key: "logoImage",
    label: "Sidebar Logo",
    hint: "Replaces the shield icon in the sidebar header. Square images work best (PNG/SVG recommended).",
    aspect: "w-16 h-16",
  },
  {
    key: "backgroundImage",
    label: "App Background",
    hint: "Full-screen background image behind the grid overlay. Landscape images work best (JPG/PNG/WebP).",
    aspect: "w-full h-28",
  },
  {
    key: "faviconImage",
    label: "Browser Favicon",
    hint: "Icon shown in the browser tab. Square PNG or ICO, 32×32 or 64×64 recommended.",
    aspect: "w-16 h-16",
  },
] as const;

type ImageKey = (typeof IMAGE_SLOTS)[number]["key"];

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user } = useGetCurrentUser();
  const { data: settings, isLoading } = useGetSettings();
  const [form, setForm] = useState(TEXT_DEFAULTS);
  const [images, setImages] = useState<Record<ImageKey, string>>({
    logoImage: "",
    backgroundImage: "",
    faviconImage: "",
  });
  const [uploading, setUploading] = useState<Record<ImageKey, boolean>>({
    logoImage: false,
    backgroundImage: false,
    faviconImage: false,
  });
  const fileInputRefs = useRef<Record<ImageKey, HTMLInputElement | null>>({
    logoImage: null,
    backgroundImage: null,
    faviconImage: null,
  });

  useEffect(() => {
    if (user && (user as any).role !== "admin") setLocation("/");
  }, [user, setLocation]);

  useEffect(() => {
    if (settings) {
      const s = settings as any;
      setForm({ ...TEXT_DEFAULTS, ...s });
      setImages({
        logoImage: s.logoImage ?? "",
        backgroundImage: s.backgroundImage ?? "",
        faviconImage: s.faviconImage ?? "",
      });
    }
  }, [settings]);

  const updateSettings = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: "Settings saved", description: "Site configuration updated." });
      },
      onError: () => toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" }),
    },
  });

  const handleSave = () => updateSettings.mutate({ data: form as any });
  const handleReset = () => setForm(TEXT_DEFAULTS);

  const [gitRepo, setGitRepo] = useState("");
  const [gitBranch, setGitBranch] = useState("main");
  const [gitSaving, setGitSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<{
    currentCommit: string;
    latestCommit: string | null;
    updateAvailable: boolean;
    gitRepo: string;
    gitBranch: string;
    error: string | null;
  } | null>(null);

  const loadGitConfig = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/update/config`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setGitRepo(data.gitRepo ?? "");
      setGitBranch(data.gitBranch ?? "main");
    } catch {}
  }, []);

  useEffect(() => { loadGitConfig(); }, [loadGitConfig]);

  const saveGitConfig = async () => {
    setGitSaving(true);
    try {
      const res = await fetch(`${BASE}/api/update/config`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gitRepo, gitBranch }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast({ title: "Git config saved", description: "Repository settings updated." });
    } catch {
      toast({ title: "Error", description: "Failed to save git configuration.", variant: "destructive" });
    } finally {
      setGitSaving(false);
    }
  };

  const checkForUpdates = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch(`${BASE}/api/update/status`, { credentials: "include" });
      if (!res.ok) throw new Error("Check failed");
      const data = await res.json();
      setUpdateStatus(data);
    } catch {
      toast({ title: "Error", description: "Could not check for updates.", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  }, []);

  const updateCommand = `sudo bash /opt/ares/docker-update.sh${gitRepo ? ` ${gitRepo}` : ""}`;

  const copyCommand = () => {
    navigator.clipboard.writeText(updateCommand).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Package upload state ──────────────────────────────────────────────────
  const [pkgFile, setPkgFile] = useState<File | null>(null);
  const [pkgUploading, setPkgUploading] = useState(false);
  const [pkgResult, setPkgResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [restartCountdown, setRestartCountdown] = useState<number | null>(null);
  const pkgInputRef = useRef<HTMLInputElement | null>(null);

  const handlePackageUpload = async () => {
    if (!pkgFile || pkgUploading) return;
    setPkgUploading(true);
    setPkgResult(null);
    try {
      const fd = new FormData();
      fd.append("package", pkgFile);
      const res = await fetch(`${BASE}/api/update/upload`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setPkgResult({ ok: false, message: data.error ?? "Upload failed" });
        return;
      }
      setPkgResult({ ok: true, message: data.message });
      setPkgFile(null);
      // Start visible countdown so user knows a restart is coming
      let count = 10;
      setRestartCountdown(count);
      const t = setInterval(() => {
        count--;
        setRestartCountdown(count);
        if (count <= 0) clearInterval(t);
      }, 1000);
    } catch (e: any) {
      setPkgResult({ ok: false, message: e.message ?? "Upload failed" });
    } finally {
      setPkgUploading(false);
    }
  };

  const handleUpload = async (key: ImageKey, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum image size is 3 MB.", variant: "destructive" });
      return;
    }
    setUploading((u) => ({ ...u, [key]: true }));
    try {
      const fd = new FormData();
      fd.append("key", key);
      fd.append("file", file);
      const res = await fetch(`${BASE}/api/settings/upload`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Upload failed");
      }
      const data = await res.json();
      setImages((prev) => ({ ...prev, [key]: data.url }));
      queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      toast({ title: "Image uploaded", description: "Image has been saved." });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading((u) => ({ ...u, [key]: false }));
    }
  };

  const handleRemove = async (key: ImageKey) => {
    try {
      const res = await fetch(`${BASE}/api/settings/upload/${key}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Remove failed");
      setImages((prev) => ({ ...prev, [key]: "" }));
      queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      toast({ title: "Image removed", description: "Reverted to default." });
    } catch {
      toast({ title: "Error", description: "Failed to remove image.", variant: "destructive" });
    }
  };

  const field = (key: keyof typeof form, label: string, hint?: string) => (
    <div>
      <label className="block text-xs font-mono tracking-widest text-muted-foreground mb-1.5 uppercase">{label}</label>
      {hint && <p className="text-xs text-muted-foreground/60 font-mono mb-2">{hint}</p>}
      <Input
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="font-mono bg-background border-border/50 focus:border-primary"
      />
    </div>
  );

  if (isLoading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <Shield className="w-8 h-8 text-primary animate-pulse" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
              <SettingsIcon className="w-7 h-7 text-primary" /> System Configuration
            </h1>
            <p className="text-muted-foreground font-mono text-sm mt-1 uppercase tracking-wider">Admin-only site customization</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} className="font-display uppercase tracking-widest text-xs border-border/50">
              <RotateCcw className="w-4 h-4 mr-2" /> Reset Defaults
            </Button>
            <Button onClick={handleSave} disabled={updateSettings.isPending} className="font-display uppercase tracking-widest text-xs">
              <Save className="w-4 h-4 mr-2" /> {updateSettings.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6 border-border/50 bg-card space-y-5">
            <h2 className="text-sm font-display font-bold uppercase tracking-widest text-primary border-b border-border/30 pb-3">
              Site Identity
            </h2>
            {field("siteName", "System Name", "The name shown in the sidebar header.")}
            {field("siteSubtitle", "System Subtitle", "The subtitle shown under the system name.")}
          </Card>

          <Card className="p-6 border-border/50 bg-card space-y-5">
            <h2 className="text-sm font-display font-bold uppercase tracking-widest text-primary border-b border-border/30 pb-3">
              Role Labels
            </h2>
            <p className="text-xs font-mono text-muted-foreground/70">
              Customize the display names for each access role. The underlying permissions remain the same.
            </p>
            <div className="space-y-4">
              <div className="bg-red-500/5 border border-red-500/20 rounded-sm p-3">
                <p className="text-[10px] font-mono text-red-400 uppercase tracking-widest mb-2">Admin Role — Full system access</p>
                {field("roleLabelAdmin", "Display Name")}
              </div>
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-sm p-3">
                <p className="text-[10px] font-mono text-amber-400 uppercase tracking-widest mb-2">Manager Role — Manage roster &amp; org</p>
                {field("roleLabelManager", "Display Name")}
              </div>
              <div className="bg-green-500/5 border border-green-500/20 rounded-sm p-3">
                <p className="text-[10px] font-mono text-green-400 uppercase tracking-widest mb-2">Viewer Role — Read-only access</p>
                {field("roleLabelViewer", "Display Name")}
              </div>
            </div>
          </Card>

          <Card className="p-6 border-border/50 bg-card space-y-5">
            <h2 className="text-sm font-display font-bold uppercase tracking-widest text-primary border-b border-border/30 pb-3">
              Organizational Hierarchy Labels
            </h2>
            <p className="text-xs font-mono text-muted-foreground/70">
              Customize what each organizational tier is called. Changes are reflected throughout the entire system.
            </p>
            <div className="space-y-4">
              <div className="bg-primary/5 border border-primary/20 rounded-sm p-3">
                <p className="text-[10px] font-mono text-primary uppercase tracking-widest mb-3">Tier 1 — Top Level (e.g., Division, Battalion, Regiment)</p>
                <div className="grid grid-cols-2 gap-3">
                  {field("tier1Label", "Singular")}
                  {field("tier1LabelPlural", "Plural")}
                </div>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-sm p-3">
                <p className="text-[10px] font-mono text-primary uppercase tracking-widest mb-3">Tier 2 — Mid Level (e.g., Company, Platoon, Unit)</p>
                <div className="grid grid-cols-2 gap-3">
                  {field("tier2Label", "Singular")}
                  {field("tier2LabelPlural", "Plural")}
                </div>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-sm p-3">
                <p className="text-[10px] font-mono text-primary uppercase tracking-widest mb-3">Tier 3 — Bottom Level (e.g., Squad, Team, Fire Team)</p>
                <div className="grid grid-cols-2 gap-3">
                  {field("tier3Label", "Singular")}
                  {field("tier3LabelPlural", "Plural")}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Images & Branding */}
        <Card className="p-6 border-border/50 bg-card">
          <h2 className="text-sm font-display font-bold uppercase tracking-widest text-primary border-b border-border/30 pb-3 mb-5 flex items-center gap-2">
            <ImageIcon className="w-4 h-4" /> Images &amp; Branding
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {IMAGE_SLOTS.map((slot) => {
              const current = images[slot.key];
              const busy = uploading[slot.key];
              return (
                <div key={slot.key} className="space-y-3">
                  <div>
                    <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase font-bold">{slot.label}</p>
                    <p className="text-[11px] font-mono text-muted-foreground/60 mt-1">{slot.hint}</p>
                  </div>

                  {/* Preview area */}
                  <div
                    className={`relative border border-border/50 rounded-sm bg-background/60 flex items-center justify-center overflow-hidden ${slot.aspect} group cursor-pointer`}
                    onClick={() => !busy && fileInputRefs.current[slot.key]?.click()}
                    title="Click to upload"
                  >
                    {current ? (
                      <>
                        <img
                          src={current}
                          alt={slot.label}
                          className="w-full h-full object-contain p-1"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Upload className="w-5 h-5 text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground/40">
                        <Upload className="w-5 h-5" />
                        <span className="text-[10px] font-mono uppercase">Click to upload</span>
                      </div>
                    )}
                    {busy && (
                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs font-display uppercase tracking-widest border-border/50 hover:border-primary/50"
                      disabled={busy}
                      onClick={() => fileInputRefs.current[slot.key]?.click()}
                    >
                      <Upload className="w-3 h-3 mr-1.5" />
                      {current ? "Replace" : "Upload"}
                    </Button>
                    {current && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs hover:bg-destructive/20 hover:text-destructive border border-border/30"
                        disabled={busy}
                        onClick={() => handleRemove(slot.key)}
                        title="Remove image"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={(el) => { fileInputRefs.current[slot.key] = el; }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(slot.key, file);
                      e.target.value = "";
                    }}
                  />
                </div>
              );
            })}
          </div>
          <p className="text-[11px] font-mono text-muted-foreground/50 mt-5 border-t border-border/20 pt-3">
            Max file size: 3 MB per image. Supported formats: PNG, JPG, WebP, SVG, GIF, ICO.
          </p>
        </Card>

        <Card className="p-4 border-primary/20 bg-primary/5">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-xs font-mono text-primary uppercase tracking-widest font-bold">Hierarchy Preview</p>
              <p className="text-sm font-mono text-muted-foreground mt-1">
                {form.tier1LabelPlural} → {form.tier2LabelPlural} → {form.tier3LabelPlural} → Roster Members
              </p>
            </div>
          </div>
        </Card>

        {/* System Updates */}
        <Card className="p-6 border-border/50 bg-card">
          <h2 className="text-sm font-display font-bold uppercase tracking-widest text-primary border-b border-border/30 pb-3 mb-5 flex items-center gap-2">
            <Download className="w-4 h-4" /> System Updates
          </h2>

          <div className="space-y-5">
            {/* Git config inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-mono tracking-widest text-muted-foreground mb-1.5 uppercase">
                  <GitBranch className="inline w-3 h-3 mr-1" /> Git Repository URL
                </label>
                <Input
                  value={gitRepo}
                  onChange={(e) => setGitRepo(e.target.value)}
                  placeholder="https://github.com/your-org/ares.git"
                  className="font-mono bg-background border-border/50 focus:border-primary text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-mono tracking-widest text-muted-foreground mb-1.5 uppercase">Branch</label>
                <Input
                  value={gitBranch}
                  onChange={(e) => setGitBranch(e.target.value)}
                  placeholder="main"
                  className="font-mono bg-background border-border/50 focus:border-primary text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={saveGitConfig}
                disabled={gitSaving}
                size="sm"
                className="font-display uppercase tracking-widest text-xs"
              >
                <Save className="w-3 h-3 mr-1.5" />
                {gitSaving ? "Saving..." : "Save Config"}
              </Button>
              <Button
                onClick={checkForUpdates}
                disabled={checking || !gitRepo}
                variant="outline"
                size="sm"
                className="font-display uppercase tracking-widest text-xs border-border/50"
                title={!gitRepo ? "Enter a git repo URL first" : undefined}
              >
                <RefreshCw className={`w-3 h-3 mr-1.5 ${checking ? "animate-spin" : ""}`} />
                {checking ? "Checking..." : "Check for Updates"}
              </Button>
            </div>

            {/* Update status */}
            {updateStatus && (
              <div className="space-y-3">
                <div className={`flex items-start gap-3 rounded-sm p-3 border ${
                  updateStatus.error
                    ? "bg-destructive/10 border-destructive/30"
                    : updateStatus.updateAvailable
                      ? "bg-yellow-500/10 border-yellow-500/30"
                      : "bg-green-500/10 border-green-500/30"
                }`}>
                  {updateStatus.error ? (
                    <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  ) : updateStatus.updateAvailable ? (
                    <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  )}
                  <div className="space-y-1 min-w-0">
                    {updateStatus.error ? (
                      <p className="text-xs font-mono text-destructive">{updateStatus.error}</p>
                    ) : updateStatus.updateAvailable ? (
                      <p className="text-xs font-mono text-yellow-400 font-bold uppercase tracking-wider">Update Available</p>
                    ) : (
                      <p className="text-xs font-mono text-green-400 font-bold uppercase tracking-wider">
                        {updateStatus.currentCommit === "unknown" ? "Up to date (version unknown)" : "Up to date"}
                      </p>
                    )}
                    {!updateStatus.error && (
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-mono text-muted-foreground">
                          Current: <span className="text-foreground/80">{updateStatus.currentCommit === "unknown" ? "unknown (dev build)" : updateStatus.currentCommit.slice(0, 12)}</span>
                        </p>
                        {updateStatus.latestCommit && (
                          <p className="text-[11px] font-mono text-muted-foreground">
                            Latest:  <span className="text-foreground/80">{updateStatus.latestCommit.slice(0, 12)}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Update command panel */}
                <div className="bg-background border border-border/40 rounded-sm p-4 space-y-3">
                  <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <Terminal className="w-3 h-3" /> Run this command on your server to apply updates:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono bg-black/40 border border-border/30 rounded-sm px-3 py-2 text-primary/90 truncate">
                      {updateCommand}
                    </code>
                    <Button
                      onClick={copyCommand}
                      variant="outline"
                      size="sm"
                      className="shrink-0 border-border/50 font-display uppercase tracking-widest text-xs"
                    >
                      {copied ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                      <span className="ml-1.5">{copied ? "Copied" : "Copy"}</span>
                    </Button>
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground/50">
                    The update script pulls the latest code, rebuilds the Docker image, and restarts the container. Your database and .env are preserved.
                  </p>
                </div>
              </div>
            )}

            {!gitRepo && (
              <p className="text-xs font-mono text-muted-foreground/50 italic">
                Enter a git repository URL above to enable update checks.
              </p>
            )}
          </div>
        </Card>

        {/* Upload Update Package */}
        <Card className="p-6 border-border/50 bg-card">
          <h2 className="text-sm font-display font-bold uppercase tracking-widest text-primary border-b border-border/30 pb-3 mb-5 flex items-center gap-2">
            <Upload className="w-4 h-4" /> Upload Update Package
          </h2>

          <div className="space-y-4">
            <p className="text-xs font-mono text-muted-foreground">
              Upload a pre-built <code className="text-primary/80 bg-primary/5 px-1 rounded">ares-update.zip</code> to apply an update without SSH access.
              The server will restart automatically after a successful upload.
            </p>

            {/* Drop zone */}
            <div
              className={`relative border-2 border-dashed rounded-lg px-6 py-8 text-center transition-colors cursor-pointer ${
                pkgFile
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/40 hover:border-primary/30 hover:bg-primary/5"
              }`}
              onClick={() => pkgInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f && f.name.endsWith(".zip")) { setPkgFile(f); setPkgResult(null); }
                else toast({ title: "Invalid file", description: "Please drop a .zip file.", variant: "destructive" });
              }}
            >
              <input
                ref={pkgInputRef}
                type="file"
                accept=".zip,application/zip"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setPkgFile(f); setPkgResult(null); }
                  e.target.value = "";
                }}
              />
              {pkgFile ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/30">
                    <Upload className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-mono text-sm text-foreground font-bold">{pkgFile.name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{(pkgFile.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  <button
                    className="ml-2 text-muted-foreground hover:text-destructive transition-colors"
                    onClick={(e) => { e.stopPropagation(); setPkgFile(null); setPkgResult(null); }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="w-6 h-6 text-muted-foreground/50 mx-auto" />
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Click or drag-drop your .zip file here</p>
                  <p className="font-mono text-[10px] text-muted-foreground/50">Max 100 MB</p>
                </div>
              )}
            </div>

            {/* Upload button */}
            <Button
              onClick={handlePackageUpload}
              disabled={!pkgFile || pkgUploading}
              className="font-display uppercase tracking-widest shadow-[0_0_10px_rgba(218,165,32,0.15)]"
            >
              <Upload className="w-4 h-4 mr-2" />
              {pkgUploading ? "Uploading & Applying..." : "Upload & Apply Update"}
            </Button>

            {/* Result */}
            {pkgResult && (
              <div className={`flex items-start gap-3 rounded-sm p-3 border ${
                pkgResult.ok ? "bg-green-500/10 border-green-500/30" : "bg-destructive/10 border-destructive/30"
              }`}>
                {pkgResult.ok
                  ? <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  : <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                }
                <div>
                  <p className={`text-xs font-mono font-bold uppercase tracking-wider ${pkgResult.ok ? "text-green-400" : "text-destructive"}`}>
                    {pkgResult.ok ? "Update Applied" : "Upload Failed"}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">{pkgResult.message}</p>
                  {pkgResult.ok && restartCountdown !== null && restartCountdown > 0 && (
                    <p className="text-xs font-mono text-primary mt-1">
                      Server restarting — page will reload in ~{restartCountdown}s
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-background border border-border/40 rounded-sm p-4 space-y-2">
              <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Terminal className="w-3 h-3" /> How to build an update package
              </p>
              <p className="text-[11px] font-mono text-muted-foreground">
                Run this on your local machine (where the source code lives):
              </p>
              <code className="block text-[11px] font-mono bg-black/40 border border-border/30 rounded-sm px-3 py-2 text-primary/90 whitespace-pre-wrap">
                {`# From the project root:\npnpm --filter @workspace/roster-app run build\npnpm --filter @workspace/api-server run build\n\n# Then zip the output:\ncp -r artifacts/roster-app/dist/public artifacts/api-server/dist/\ncd artifacts/api-server && zip -r ares-update.zip dist/index.cjs dist/public/`}
              </code>
              <p className="text-[10px] font-mono text-muted-foreground/50">
                The ZIP must contain <code className="text-primary/70">dist/index.cjs</code> and <code className="text-primary/70">dist/public/</code> at its root. A backup of the current server bundle is saved as <code className="text-primary/70">index.cjs.bak</code> before applying.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
