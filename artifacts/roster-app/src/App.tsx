import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import RosterIndex from "@/pages/roster/index";
import RosterNew from "@/pages/roster/new";
import RosterEdit from "@/pages/roster/edit";
import Ranks from "@/pages/ranks";
import Squads from "@/pages/squads";
import Users from "@/pages/users";
import Activity from "@/pages/activity";
import SetupMfa from "@/pages/setup-mfa";
import Profile from "@/pages/profile";

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
      <Route path="/users" component={Users} />
      <Route path="/activity" component={Activity} />
      <Route path="/setup-mfa" component={SetupMfa} />
      <Route path="/profile" component={Profile} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
