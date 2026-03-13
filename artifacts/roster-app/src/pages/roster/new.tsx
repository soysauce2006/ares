import React from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, UserPlus, ShieldAlert } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateMember, useListRanks, useListSquads, getListMembersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

const formSchema = z.object({
  username: z.string().min(2, "Identifier must be at least 2 chars").max(50),
  displayName: z.string().optional(),
  rankId: z.coerce.number().optional().nullable(),
  squadId: z.coerce.number().optional().nullable(),
  status: z.enum(["active", "inactive", "suspended"]).default("active"),
  notes: z.string().optional(),
});

export default function RosterNew() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: ranks } = useListRanks();
  const { data: squads } = useListSquads();
  
  const { mutateAsync: createMember, isPending } = useCreateMember();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      displayName: "",
      status: "active",
      notes: "",
      // react-hook-form needs empty strings or valid values for select
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      await createMember({ 
        data: {
          ...data,
          // Convert 0/null/undefined logic properly
          rankId: data.rankId || undefined,
          squadId: data.squadId || undefined,
        } as any // type coercions for optional fields
      });
      queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
      toast({ title: "Registration Complete", description: "Operative added to tactical roster." });
      setLocation("/roster");
    } catch (err: any) {
      toast({ title: "Registration Failed", description: err.message || "Unknown error", variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="hover:bg-secondary/50" asChild>
            <Link href="/roster"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-display uppercase tracking-widest text-foreground font-bold flex items-center gap-3">
              <UserPlus className="w-8 h-8 text-primary" /> Enlist Personnel
            </h1>
            <p className="font-mono text-sm text-muted-foreground mt-1 uppercase">Initialize new operative dossier</p>
          </div>
        </div>

        <Card className="border-primary/20 bg-card/60 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
          <CardHeader className="border-b border-border/30 bg-black/20 pb-4">
            <CardTitle className="font-mono text-sm tracking-widest uppercase text-primary">Classified Entry Form</CardTitle>
            <CardDescription className="font-mono text-xs uppercase">All fields marked with an asterisk are required for proper clearance.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
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
                          <Input placeholder="E.g., JDOE" className="bg-secondary/50 border-border/50 focus:border-primary/50 font-mono" {...field} />
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
                          <Input placeholder="E.g., Ghost" className="bg-secondary/50 border-border/50 focus:border-primary/50 font-mono" {...field} value={field.value || ''} />
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
                          <SelectItem value="active" className="text-primary focus:text-primary">Active (Combat Ready)</SelectItem>
                          <SelectItem value="inactive" className="text-muted-foreground">Inactive (Standby)</SelectItem>
                          <SelectItem value="suspended" className="text-destructive focus:text-destructive">Suspended (Restricted)</SelectItem>
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
                          placeholder="Enter any additional intelligence..." 
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
                    {isPending ? "Committing to DB..." : "Save Dossier"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
