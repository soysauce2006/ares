import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SettingsProvider } from "@/contexts/settings-context";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import RosterIndex from "@/pages/roster/index";
import RosterNew from "@/pages/roster/new";
import RosterEdit from "@/pages/roster/edit";
import Ranks from "@/pages/ranks";
import Squads from "@/pages/squads";
import Units from "@/pages/units";
import Divisions from "@/pages/divisions";
import Users from "@/pages/users";
import Activity from "@/pages/activity";
import SetupMfa from "@/pages/setup-mfa";
import Profile from "@/pages/profile";
import ChangePassword from "@/pages/change-password";
import Settings from "@/pages/settings";
import Clearances from "@/pages/clearances";
import Messages from "@/pages/messages";
import Roles from "@/pages/roles";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={Dashboard} />
      <Route path="/roster" component={RosterIndex} />
      <Route path="/roster/new" component={RosterNew} />
      <Route path="/roster/:id/edit" component={RosterEdit} />
      <Route path="/ranks" component={Ranks} />
      <Route path="/squads" component={Squads} />
      <Route path="/units" component={Units} />
      <Route path="/divisions" component={Divisions} />
      <Route path="/users" component={Users} />
      <Route path="/activity" component={Activity} />
      <Route path="/setup-mfa" component={SetupMfa} />
      <Route path="/profile" component={Profile} />
      <Route path="/change-password" component={ChangePassword} />
      <Route path="/settings" component={Settings} />
      <Route path="/clearances" component={Clearances} />
      <Route path="/messages" component={Messages} />
      <Route path="/roles" component={Roles} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <SettingsProvider>
            <Router />
          </SettingsProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
