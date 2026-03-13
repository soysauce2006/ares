import { useState, useEffect } from "react";
import { Shield, Save, RotateCcw, Settings as SettingsIcon } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetSettingsQueryKey } from "@workspace/api-client-react";
import { toast } from "@/hooks/use-toast";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { useLocation } from "wouter";

const DEFAULTS = {
  siteName: "A.R.E.S.",
  siteSubtitle: "Advanced Roster Execution System",
  tier1Label: "Division",
  tier1LabelPlural: "Divisions",
  tier2Label: "Company",
  tier2LabelPlural: "Companies",
  tier3Label: "Squad",
  tier3LabelPlural: "Squads",
};

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user } = useGetCurrentUser();
  const { data: settings, isLoading } = useGetSettings();
  const [form, setForm] = useState(DEFAULTS);

  useEffect(() => {
    if (user && (user as any).role !== "admin") setLocation("/");
  }, [user, setLocation]);

  useEffect(() => {
    if (settings) setForm({ ...DEFAULTS, ...(settings as any) });
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

  const handleSave = () => {
    updateSettings.mutate({ data: form as any });
  };

  const handleReset = () => {
    setForm(DEFAULTS);
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
