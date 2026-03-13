import React from "react";
import { motion } from "framer-motion";
import { 
  Users, 
  UserCheck, 
  Crosshair, 
  Medal, 
  Activity as ActivityIcon,
  ShieldAlert
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { format } from "date-fns";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

function StatCard({ title, value, icon: Icon, description, index }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
    >
      <Card className="relative overflow-hidden border-border/40 bg-card/40 backdrop-blur-sm group hover:border-primary/30 transition-colors">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
          <Icon className="w-24 h-24 text-primary" />
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Icon className="w-3 h-3 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-display font-bold text-foreground tracking-tight">{value}</div>
          <p className="text-xs font-mono text-primary/60 mt-2 uppercase tracking-wider">{description}</p>
        </CardContent>
        {/* Decorative corner accent */}
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/40 m-1" />
      </Card>
    </motion.div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading, isError } = useGetDashboardStats();

  if (isError) {
    return (
      <AppLayout>
        <div className="p-6 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-4">
          <ShieldAlert className="w-6 h-6 text-destructive shrink-0" />
          <div>
            <h3 className="font-display uppercase text-destructive tracking-widest font-bold">Telemetry Failure</h3>
            <p className="font-mono text-sm text-destructive/80 mt-1">Unable to establish connection with command servers.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display uppercase tracking-widest text-foreground font-bold">Command Overview</h1>
          <p className="font-mono text-sm text-muted-foreground mt-1 uppercase">Global status and strategic metrics</p>
        </div>

        {/* STATS GRID */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 bg-card/50" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard index={0} title="Total Personnel" value={stats.totalMembers} icon={Users} description="Active & Inactive" />
            <StatCard index={1} title="Combat Ready" value={stats.activeMembers} icon={UserCheck} description="Deployed Assets" />
            <StatCard index={2} title="Active Squads" value={stats.totalSquads} icon={Crosshair} description="Operational Units" />
            <StatCard index={3} title="Command Tiers" value={stats.totalRanks} icon={Medal} description="Hierarchy Levels" />
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* CHARTS */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/40 bg-card/40 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="font-display uppercase tracking-widest text-lg">Asset Distribution: Ranks</CardTitle>
                <CardDescription className="font-mono text-xs uppercase">Personnel count by hierarchy level</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {isLoading ? (
                  <Skeleton className="w-full h-full bg-secondary/30" />
                ) : stats && stats.membersByRank.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.membersByRank} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis 
                        dataKey="rankName" 
                        stroke="rgba(255,255,255,0.4)" 
                        tick={{ fontFamily: 'JetBrains Mono', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="rgba(255,255,255,0.4)" 
                        tick={{ fontFamily: 'JetBrains Mono', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', fontFamily: 'JetBrains Mono', fontSize: '12px' }}
                        itemStyle={{ color: 'hsl(var(--primary))' }}
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      />
                      <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                        {stats.membersByRank.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-mono text-sm text-muted-foreground uppercase">Insufficient Data</div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/40 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="font-display uppercase tracking-widest text-lg">Asset Distribution: Squads</CardTitle>
                <CardDescription className="font-mono text-xs uppercase">Personnel count by operational unit</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {isLoading ? (
                  <Skeleton className="w-full h-full bg-secondary/30" />
                ) : stats && stats.membersBySquad.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.membersBySquad} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                      <XAxis 
                        type="number" 
                        stroke="rgba(255,255,255,0.4)" 
                        tick={{ fontFamily: 'JetBrains Mono', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        dataKey="squadName" 
                        type="category" 
                        stroke="rgba(255,255,255,0.4)" 
                        tick={{ fontFamily: 'JetBrains Mono', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', fontFamily: 'JetBrains Mono', fontSize: '12px' }}
                        itemStyle={{ color: 'hsl(var(--chart-3))' }}
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[0, 2, 2, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-mono text-sm text-muted-foreground uppercase">Insufficient Data</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RECENT ACTIVITY */}
          <Card className="border-border/40 bg-card/40 backdrop-blur-sm lg:row-span-2">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="font-display uppercase tracking-widest text-lg flex items-center gap-2">
                <ActivityIcon className="w-4 h-4 text-primary" /> System Logs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/30 h-full overflow-y-auto max-h-[650px]">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="p-4 space-y-2">
                      <Skeleton className="h-4 w-1/2 bg-secondary/30" />
                      <Skeleton className="h-3 w-1/3 bg-secondary/30" />
                    </div>
                  ))
                ) : stats && stats.recentActivity.length > 0 ? (
                  stats.recentActivity.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-secondary/20 transition-colors group">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            <span className="text-primary font-mono mr-2">[{log.userUsername || 'SYS'}]</span>
                            {log.action}
                          </p>
                          <p className="text-xs font-mono text-muted-foreground mt-1 truncate">
                            {log.entityType && <span className="uppercase">{log.entityType} {log.entityId && `#${log.entityId}`}</span>}
                            {log.details && <span> - {log.details}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="text-[10px] font-mono text-primary/60 mt-2 uppercase tracking-widest">
                        {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center font-mono text-sm text-muted-foreground uppercase">No recent activity detected</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
