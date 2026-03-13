import React, { useState } from "react";
import { format } from "date-fns";
import { Activity as ActivityIcon, Server } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useListActivityLogs } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function Activity() {
  const [page, setPage] = useState(0);
  const limit = 50;
  
  const { data, isLoading } = useListActivityLogs({
    query: {
      queryKey: ['/api/activity', { limit, offset: page * limit }]
    },
    request: { /* custom request config if needed */ }
  }, { limit, offset: page * limit }); // Assuming the hook takes params based on api client

  const hasMore = data ? (page + 1) * limit < data.total : false;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display uppercase tracking-widest text-foreground font-bold flex items-center gap-3">
            <ActivityIcon className="w-8 h-8 text-primary" /> System Telemetry
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-1 uppercase">Immutable audit log of command actions</p>
        </div>

        <Card className="border-border/40 bg-card/60 backdrop-blur-md overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Server className="w-64 h-64 text-primary" />
          </div>
          
          <div className="overflow-x-auto relative z-10">
            <Table>
              <TableHeader className="bg-black/40">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="font-display tracking-widest uppercase text-primary/80 w-[180px]">Timestamp (UTC)</TableHead>
                  <TableHead className="font-display tracking-widest uppercase text-primary/80 w-[150px]">Operative</TableHead>
                  <TableHead className="font-display tracking-widest uppercase text-primary/80 w-[150px]">Action</TableHead>
                  <TableHead className="font-display tracking-widest uppercase text-primary/80">Target / Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i} className="border-border/30">
                      <TableCell><Skeleton className="h-4 w-32 bg-secondary/30" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24 bg-secondary/30" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24 bg-secondary/30" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-64 bg-secondary/30" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.logs.length === 0 ? (
                  <TableRow className="border-border/30 hover:bg-transparent">
                    <TableCell colSpan={4} className="h-32 text-center">
                      <span className="font-mono text-muted-foreground uppercase tracking-widest">Telemetry empty. No logs found.</span>
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.logs.map((log) => (
                    <TableRow key={log.id} className="border-border/30 hover:bg-secondary/20 transition-colors">
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")}
                      </TableCell>
                      <TableCell className="font-mono text-xs uppercase text-primary">
                        {log.userUsername || 'SYSTEM'}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                        {log.action}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        <div className="flex flex-col gap-1">
                          {log.entityType && (
                            <span className="text-accent">
                              TARGET: {log.entityType} {log.entityId ? `#${log.entityId}` : ''}
                            </span>
                          )}
                          {log.details && <span>{log.details}</span>}
                          {log.ipAddress && <span className="opacity-50">SRC: {log.ipAddress}</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="p-4 border-t border-border/50 bg-black/20 flex items-center justify-between z-10 relative">
            <span className="font-mono text-xs text-muted-foreground uppercase">
              Showing logs {(page * limit) + 1} - {Math.min((page + 1) * limit, data?.total || 0)} of {data?.total || 0}
            </span>
            <div className="space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="font-display uppercase tracking-widest text-xs border-border/50"
              >
                Previous
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={!hasMore}
                onClick={() => setPage(p => p + 1)}
                className="font-display uppercase tracking-widest text-xs border-border/50"
              >
                Next Stream
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
