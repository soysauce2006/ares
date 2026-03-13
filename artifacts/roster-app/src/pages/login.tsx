import React, { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, KeyRound, AlertTriangle, Fingerprint, Lock, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLogin, useVerifyMfa, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Valid operational email required"),
  password: z.string().min(1, "Passcode required"),
});

const mfaSchema = z.object({
  code: z.string().min(6, "6-digit authorization code required").max(6),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [mfaToken, setMfaToken] = useState<string | null>(null);

  const { mutateAsync: login, isPending: isLoggingIn } = useLogin();
  const { mutateAsync: verifyMfa, isPending: isVerifying } = useVerifyMfa();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const mfaForm = useForm<z.infer<typeof mfaSchema>>({
    resolver: zodResolver(mfaSchema),
    defaultValues: { code: "" },
  });

  const onLoginSubmit = async (data: z.infer<typeof loginSchema>) => {
    try {
      const result = await login({ data });
      if (result.requiresMfa && result.mfaToken) {
        setMfaToken(result.mfaToken);
        toast({ title: "Authorization Level 2 Required", description: "Please enter your MFA token." });
      } else {
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        toast({ title: "Access Granted", description: "Welcome to Command Center." });
        setLocation("/");
      }
    } catch (err: any) {
      toast({ 
        title: "Access Denied", 
        description: err.message || "Invalid credentials provided.", 
        variant: "destructive" 
      });
    }
  };

  const onMfaSubmit = async (data: z.infer<typeof mfaSchema>) => {
    if (!mfaToken) return;
    try {
      await verifyMfa({ data: { mfaToken, code: data.code } });
      queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      toast({ title: "Authorization Confirmed", description: "Welcome to Command Center." });
      setLocation("/");
    } catch (err: any) {
      toast({ 
        title: "Authorization Failed", 
        description: err.message || "Invalid MFA code.", 
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="min-h-screen bg-background bg-grid-pattern relative flex items-center justify-center p-4">
      {/* Abstract background elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md z-10"
      >
        <Card className="border-primary/20 bg-card/80 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden relative">
          {/* Top border highlight */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
          
          <CardHeader className="space-y-4 pb-8 text-center pt-10">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl border border-primary/30 flex items-center justify-center shadow-[0_0_20px_rgba(218,165,32,0.2)] mb-2">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-3xl font-display uppercase tracking-[0.2em] text-foreground">A.R.E.S.</CardTitle>
            <CardDescription className="font-mono text-xs uppercase tracking-widest text-primary/80">
              Advanced Roster Execution System
            </CardDescription>
          </CardHeader>

          <CardContent className="px-8">
            <AnimatePresence mode="wait">
              {!mfaToken ? (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
                      <FormField
                        control={loginForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                              <UserIcon className="w-3 h-3" /> Identity Marker (Email)
                            </FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="operative@command.mil" 
                                className="bg-secondary/50 border-border focus:border-primary/50 focus:ring-primary/20 h-12 font-mono text-sm"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage className="font-mono text-xs" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                              <KeyRound className="w-3 h-3" /> Security Passcode
                            </FormLabel>
                            <FormControl>
                              <Input 
                                type="password" 
                                placeholder="••••••••" 
                                className="bg-secondary/50 border-border focus:border-primary/50 focus:ring-primary/20 h-12 font-mono"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage className="font-mono text-xs" />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        disabled={isLoggingIn}
                        className="w-full h-12 font-display uppercase tracking-widest text-base shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300"
                      >
                        {isLoggingIn ? "Authenticating..." : "Initialize Uplink"}
                      </Button>
                    </form>
                  </Form>
                </motion.div>
              ) : (
                <motion.div
                  key="mfa"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-6 p-4 border border-primary/30 bg-primary/5 rounded-lg flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-display font-bold uppercase text-primary text-sm tracking-wider">Level 2 Authorization Required</h4>
                      <p className="text-xs font-mono text-muted-foreground mt-1">Please enter the 6-digit passcode from your registered authenticator device.</p>
                    </div>
                  </div>

                  <Form {...mfaForm}>
                    <form onSubmit={mfaForm.handleSubmit(onMfaSubmit)} className="space-y-6">
                      <FormField
                        control={mfaForm.control}
                        name="code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                              <Fingerprint className="w-3 h-3" /> TOTP Sequence
                            </FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="000000" 
                                maxLength={6}
                                className="bg-secondary/50 border-border focus:border-primary/50 focus:ring-primary/20 h-14 text-center font-mono text-2xl tracking-[0.5em]"
                                {...field} 
                                onChange={e => {
                                  // Only allow numbers
                                  const val = e.target.value.replace(/[^0-9]/g, '');
                                  field.onChange(val);
                                }}
                              />
                            </FormControl>
                            <FormMessage className="font-mono text-xs" />
                          </FormItem>
                        )}
                      />
                      <div className="flex gap-3">
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => setMfaToken(null)}
                          className="w-1/3 h-12 font-display uppercase tracking-widest text-sm border-border/50"
                        >
                          Abort
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={isVerifying}
                          className="w-2/3 h-12 font-display uppercase tracking-widest text-sm shadow-lg shadow-primary/20"
                        >
                          {isVerifying ? "Verifying..." : "Confirm"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
          <CardFooter className="pt-6 pb-8 justify-center">
            <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground uppercase tracking-widest opacity-50">
              <Lock className="w-3 h-3" /> End-to-End Encrypted
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
