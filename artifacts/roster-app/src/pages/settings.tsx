import { useState, useEffect, useRef } from "react";
import { Shield, Save, RotateCcw, Settings as SettingsIcon, Upload, X, Image as ImageIcon } from "lucide-react";
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
      </div>
    </AppLayout>
  );
}
