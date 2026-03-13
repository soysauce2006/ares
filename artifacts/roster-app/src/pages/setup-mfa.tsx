import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Shield, Fingerprint, ArrowRight } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSetupMfa, useConfirmMfa, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

export default function SetupMfa() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [mfaData, setMfaData] = useState<{ secret: string; qrCodeUrl: string } | null>(null);

  const { mutateAsync: setupMfa, isPending: isSettingUp } = useSetupMfa();
  const { mutateAsync: confirmMfa, isPending: isConfirming } = useConfirmMfa();

  useEffect(() => {
    setupMfa()
      .then((data) => setMfaData(data))
      .catch((err) => {
        toast({ title: "Setup Failed", description: err.message || "Failed to initialize MFA setup.", variant: "destructive" });
      });
  }, []);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaData || code.length !== 6) return;

    try {
      await confirmMfa({ data: { code, secret: mfaData.secret } });
      queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      toast({ title: "Protocol Active", description: "Level 2 authentication successfully enabled." });
      setLocation("/");
    } catch (err: any) {
      toast({ title: "Verification Failed", description: err.message || "Invalid security code.", variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6 mt-10">
        <div>
          <h1 className="text-3xl font-display uppercase tracking-widest text-foreground font-bold flex items-center gap-3">
            <Fingerprint className="w-8 h-8 text-primary" /> Security Upgrade
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-1 uppercase">Initialize Level 2 Authentication Protocols</p>
        </div>

        <Card className="border-primary/20 bg-card/60 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
          <CardHeader className="bg-black/20 border-b border-border/30">
            <CardTitle className="font-display uppercase tracking-widest text-primary">Device Pairing</CardTitle>
            <CardDescription className="font-mono text-xs uppercase">Follow the sequence below to bind your authorization device.</CardDescription>
          </CardHeader>
          <CardContent className="pt-8">
            {isSettingUp || !mfaData ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Shield className="w-12 h-12 text-primary animate-pulse" />
                <p className="font-mono text-sm uppercase tracking-widest text-primary/70">Generating Crypto Keys...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="font-display font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-mono text-xs border border-primary/50">1</span>
                      Scan Pattern
                    </h3>
                    <p className="font-mono text-xs text-muted-foreground">Scan this visual cryptography pattern using your authenticator app (Google Authenticator, Authy, etc.).</p>
                  </div>
                  <div className="p-4 bg-white rounded-lg inline-block mx-auto border-4 border-primary/30 shadow-[0_0_20px_rgba(218,165,32,0.15)]">
                    <img src={mfaData.qrCodeUrl} alt="MFA QR Code" className="w-48 h-48" />
                  </div>
                  <div className="p-3 bg-secondary/50 border border-border/50 rounded font-mono text-[10px] text-muted-foreground break-all">
                    MANUAL KEY: <span className="text-primary font-bold">{mfaData.secret}</span>
                  </div>
                </div>

                <div className="space-y-6 md:border-l border-border/30 md:pl-8 h-full flex flex-col justify-center">
                  <div className="space-y-2">
                    <h3 className="font-display font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-mono text-xs border border-primary/50">2</span>
                      Verify Link
                    </h3>
                    <p className="font-mono text-xs text-muted-foreground">Enter the 6-digit sequence generated by your device to confirm linkage.</p>
                  </div>
                  
                  <form onSubmit={handleConfirm} className="space-y-4">
                    <Input 
                      placeholder="000000" 
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                      className="bg-secondary/50 border-primary/30 focus:border-primary focus:ring-primary/20 h-16 text-center font-mono text-3xl tracking-[0.5em]"
                    />
                    <Button 
                      type="submit" 
                      disabled={code.length !== 6 || isConfirming}
                      className="w-full h-12 font-display uppercase tracking-widest shadow-lg shadow-primary/20"
                    >
                      {isConfirming ? "Validating..." : "Confirm Protocol"} <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
