import React, { createContext, useContext } from "react";
import { useGetSettings } from "@workspace/api-client-react";

export interface SiteSettings {
  siteName: string;
  siteSubtitle: string;
  tier1Label: string;
  tier1LabelPlural: string;
  tier2Label: string;
  tier2LabelPlural: string;
  tier3Label: string;
  tier3LabelPlural: string;
  logoImage: string;
  backgroundImage: string;
  faviconImage: string;
  roleLabelAdmin: string;
  roleLabelManager: string;
  roleLabelViewer: string;
}

const DEFAULTS: SiteSettings = {
  siteName: "A.R.E.S.",
  siteSubtitle: "Advanced Roster Execution System",
  tier1Label: "Division",
  tier1LabelPlural: "Divisions",
  tier2Label: "Company",
  tier2LabelPlural: "Companies",
  tier3Label: "Squad",
  tier3LabelPlural: "Squads",
  logoImage: "",
  backgroundImage: "",
  faviconImage: "",
  roleLabelAdmin: "Admin",
  roleLabelManager: "Manager",
  roleLabelViewer: "Viewer",
};

export function getRoleLabel(role: string, settings: SiteSettings): string {
  switch (role) {
    case "admin": return settings.roleLabelAdmin || "Admin";
    case "manager": return settings.roleLabelManager || "Manager";
    case "viewer": return settings.roleLabelViewer || "Viewer";
    default: return role;
  }
}

const SettingsContext = createContext<SiteSettings>(DEFAULTS);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { data } = useGetSettings({ query: { staleTime: 60_000 } });
  const settings: SiteSettings = data ? { ...DEFAULTS, ...(data as any) } : DEFAULTS;
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
