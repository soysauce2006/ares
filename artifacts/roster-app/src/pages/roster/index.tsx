import React, { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Plus, Search, Filter, Edit, Trash2, MoreHorizontal, Shield } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useListMembers, useDeleteMember, getListMembersQueryKey, useGetCurrentUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function RosterIndex() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: currentUser } = useGetCurrentUser();
  const { data: members, isLoading } = useListMembers();
  const { mutate: deleteMember, isPending: isDeleting } = useDeleteMember({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
        toast({ title: "Target Eliminated", description: "Roster member successfully removed from registry." });
        setDeleteId(null);
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message || "Failed to remove member", variant: "destructive" });
        setDeleteId(null);
      }
    }
  });

  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const filteredMembers = members?.filter(m => 
    m.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.rankName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.squadName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-primary/20 text-primary border-primary/50';
      case 'inactive': return 'bg-muted/50 text-muted-foreground border-border';
      case 'suspended': return 'bg-destructive/20 text-destructive border-destructive/50';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display uppercase tracking-widest text-foreground font-bold flex items-center gap-3">
              <Shield className="w-8 h-8 text-primary" /> Active Roster
            </h1>
            <p className="font-mono text-sm text-muted-foreground mt-1 uppercase">Complete tactical personnel registry</p>
          </div>
          
          {canManage && (
            <Button className="font-display uppercase tracking-widest shadow-[0_0_15px_rgba(218,165,32,0.2)]" asChild>
              <Link href="/roster/new">
                <Plus className="w-4 h-4 mr-2" /> Enlist Personnel
              </Link>
            </Button>
          )}
        </div>

        <Card className="border-border/40 bg-card/60 backdrop-blur-md overflow-hidden">
          <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row gap-4 bg-black/20">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="SEARCH REGISTRY..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background/50 border-border/50 focus:border-primary/50 font-mono text-sm uppercase placeholder:text-muted-foreground/50"
              />
            </div>
            <Button variant="outline" className="font-mono uppercase text-xs tracking-widest border-border/50 bg-background/50">
              <Filter className="w-4 h-4 mr-2" /> Filter
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-black/40">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="font-display tracking-widest uppercase text-primary/80">Operative</TableHead>
                  <TableHead className="font-display tracking-widest uppercase text-primary/80">Rank</TableHead>
                  <TableHead className="font-display tracking-widest uppercase text-primary/80">Squad</TableHead>
                  <TableHead className="font-display tracking-widest uppercase text-primary/80">Status</TableHead>
                  <TableHead className="font-display tracking-widest uppercase text-primary/80">Enlist Date</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-border/30">
                      <TableCell><Skeleton className="h-5 w-32 bg-secondary/30" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 bg-secondary/30" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 bg-secondary/30" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full bg-secondary/30" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 bg-secondary/30" /></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))
                ) : filteredMembers?.length === 0 ? (
                  <TableRow className="border-border/30 hover:bg-transparent">
                    <TableCell colSpan={6} className="h-32 text-center">
                      <span className="font-mono text-muted-foreground uppercase tracking-widest">No personnel found matching criteria.</span>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMembers?.map((member) => (
                    <TableRow key={member.id} className="border-border/30 hover:bg-secondary/20 transition-colors group">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground">{member.username}</span>
                          {member.displayName && (
                            <span className="text-xs text-muted-foreground font-mono uppercase">{member.displayName}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {member.rankName ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-primary">{member.rankAbbreviation}</span>
                            <span className="text-xs text-muted-foreground uppercase">{member.rankName}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground font-mono uppercase">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium uppercase tracking-wide text-foreground/80">
                          {member.squadName || "Unassigned"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`font-mono text-[10px] uppercase tracking-widest ${getStatusColor(member.status)}`}>
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {format(new Date(member.joinedAt), "yyyy-MM-dd")}
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0 opacity-50 group-hover:opacity-100 data-[state=open]:opacity-100">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-card/95 backdrop-blur-xl border-border/50 font-mono text-xs uppercase tracking-wider">
                              <DropdownMenuLabel className="text-primary/70">Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator className="bg-border/50" />
                              <DropdownMenuItem asChild className="cursor-pointer focus:bg-primary/20 focus:text-primary">
                                <Link href={`/roster/${member.id}/edit`} className="flex items-center w-full">
                                  <Edit className="mr-2 h-4 w-4" /> Update Dossier
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-border/50" />
                              <DropdownMenuItem 
                                onClick={() => setDeleteId(member.id)}
                                className="cursor-pointer text-destructive focus:bg-destructive/20 focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Terminate Record
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-destructive/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display uppercase tracking-widest text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Confirm Termination
            </AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-muted-foreground uppercase text-xs">
              This action cannot be undone. The operative's record will be permanently purged from the tactical registry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-display uppercase tracking-widest text-xs border-border/50">Abort</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteId && deleteMember({ id: deleteId })}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-display uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(220,38,38,0.3)]"
            >
              {isDeleting ? "Processing..." : "Execute"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
