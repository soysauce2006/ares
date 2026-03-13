import React, { useEffect } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, UserCog, ShieldAlert } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGetMember, useUpdateMember, useListRanks, useListSquads, getListMembersQueryKey, getGetMemberQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const formSchema = z.object({
  username: z.string().min(2).max(50),
  displayName: z.string().optional(),
  rankId: z.coerce.number().optional().nullable(),
  squadId: z.coerce.number().optional().nullable(),
  status: z.enum(["active", "inactive", "suspended"]),
  notes: z.string().optional(),
});

export default function RosterEdit() {
  const { id } = useParams();
  const numericId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: member, isLoading: isLoadingMember, isError } = useGetMember(numericId, {
    query: { enabled: !!numericId }
  });
  
  const { data: ranks } = useListRanks();
  const { data: squads } = useListSquads();
  
  const { mutateAsync: updateMember, isPending } = useUpdateMember();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      displayName: "",
      status: "active",
      notes: "",
    },
  });

  // Load data into form when available
  useEffect(() => {
    if (member) {
      form.reset({
        username: member.username,
        displayName: member.displayName || "",
        rankId: member.rankId,
        squadId: member.squadId,
        status: member.status,
        notes: member.notes || "",
      });
    }
  }, [member, form]);

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      await updateMember({ 
        id: numericId,
        data: {
          ...data,
          rankId: data.rankId || null,
          squadId: data.squadId || null,
        } as any
      });
      queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetMemberQueryKey(numericId) });
      toast({ title: "Update Successful", description: "Operative dossier has been amended." });
      setLocation("/roster");
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message || "Unknown error", variant: "destructive" });
    }
  };

  if (isError) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto p-6 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-4">
          <ShieldAlert className="w-6 h-6 text-destructive shrink-0" />
          <div>
            <h3 className="font-display uppercase text-destructive tracking-widest font-bold">Record Not Found</h3>
            <p className="font-mono text-sm text-destructive/80 mt-1">The specified operative could not be located in the registry.</p>
            <Button variant="outline" className="mt-4 border-destructive/50 text-destructive" asChild>
              <Link href="/roster">Return to Roster</Link>
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="hover:bg-secondary/50" asChild>
            <Link href="/roster"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-display uppercase tracking-widest text-foreground font-bold flex items-center gap-3">
              <UserCog className="w-8 h-8 text-primary" /> Amend Dossier
            </h1>
            <p className="font-mono text-sm text-muted-foreground mt-1 uppercase">
              Target ID: {isLoadingMember ? <Skeleton className="inline-block w-16 h-4 align-middle" /> : `#${member?.id.toString().padStart(4, '0')}`}
            </p>
          </div>
        </div>

        <Card className="border-primary/20 bg-card/60 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
          <CardHeader className="border-b border-border/30 bg-black/20 pb-4">
            <CardTitle className="font-mono text-sm tracking-widest uppercase text-primary">Operative Details</CardTitle>
            <CardDescription className="font-mono text-xs uppercase">Ensure accuracy before committing changes to secure storage.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoadingMember ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <Skeleton className="h-16 bg-secondary/30" />
                  <Skeleton className="h-16 bg-secondary/30" />
                  <Skeleton className="h-16 bg-secondary/30" />
                  <Skeleton className="h-16 bg-secondary/30" />
                </div>
                <Skeleton className="h-32 bg-secondary/30" />
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Primary Identifier *</FormLabel>
                          <FormControl>
                            <Input className="bg-secondary/50 border-border/50 focus:border-primary/50 font-mono" {...field} />
                          </FormControl>
                          <FormMessage className="font-mono text-xs text-destructive" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="displayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Callsign / Display Name</FormLabel>
                          <FormControl>
                            <Input className="bg-secondary/50 border-border/50 focus:border-primary/50 font-mono" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage className="font-mono text-xs text-destructive" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="rankId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Clearance Level (Rank)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value?.toString() || ""}>
                            <FormControl>
                              <SelectTrigger className="bg-secondary/50 border-border/50 font-mono">
                                <SelectValue placeholder="Assign Rank" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-card border-border/50 font-mono text-sm uppercase">
                              <SelectItem value="none">UNASSIGNED</SelectItem>
                              {ranks?.sort((a,b) => b.level - a.level).map(r => (
                                <SelectItem key={r.id} value={r.id.toString()}>{r.abbreviation} - {r.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage className="font-mono text-xs text-destructive" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="squadId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Operational Unit (Squad)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value?.toString() || ""}>
                            <FormControl>
                              <SelectTrigger className="bg-secondary/50 border-border/50 font-mono">
                                <SelectValue placeholder="Assign Squad" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-card border-border/50 font-mono text-sm uppercase">
                              <SelectItem value="none">UNASSIGNED</SelectItem>
                              {squads?.map(s => (
                                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage className="font-mono text-xs text-destructive" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Operational Status *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-secondary/50 border-border/50 font-mono">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card border-border/50 font-mono text-sm uppercase">
                            <SelectItem value="active" className="text-primary">Active (Combat Ready)</SelectItem>
                            <SelectItem value="inactive" className="text-muted-foreground">Inactive (Standby)</SelectItem>
                            <SelectItem value="suspended" className="text-destructive">Suspended (Restricted)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="font-mono text-xs text-destructive" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Classified Remarks</FormLabel>
                        <FormControl>
                          <Textarea 
                            className="bg-secondary/50 border-border/50 focus:border-primary/50 font-mono min-h-[100px] resize-y" 
                            {...field}
                            value={field.value || ''} 
                          />
                        </FormControl>
                        <FormMessage className="font-mono text-xs text-destructive" />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-4 pt-4 border-t border-border/30 mt-8">
                    <Button variant="outline" type="button" className="font-display uppercase tracking-widest border-border/50" asChild>
                      <Link href="/roster">Abort</Link>
                    </Button>
                    <Button type="submit" disabled={isPending} className="font-display uppercase tracking-widest shadow-[0_0_15px_rgba(218,165,32,0.2)]">
                      {isPending ? "Transmitting..." : "Update Dossier"}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
