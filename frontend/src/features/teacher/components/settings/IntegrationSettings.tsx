"use client";

import * as React from "react";
import { Video, Cloud, CreditCard, CheckCircle2, Link2, ExternalLink, Blocks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function IntegrationSettings() {
  const integrations = [
    { id: "1", name: "Zoom", description: "Connect Zoom to automatically generate meeting links for your live sessions.", icon: "Video", status: "disconnected" },
    { id: "2", name: "Google Drive", description: "Sync course materials and student submissions directly with Google Drive.", icon: "Cloud", status: "disconnected" },
    { id: "3", name: "Stripe", description: "Connect Stripe to process payments and receive payouts.", icon: "CreditCard", status: "disconnected" },
  ];

  const getIcon = (iconName: string) => {
    switch(iconName) {
      case "Video": return <Video className="h-6 w-6" />;
      case "Cloud": return <Cloud className="h-6 w-6" />;
      case "CreditCard": return <CreditCard className="h-6 w-6" />;
      default: return <Link2 className="h-6 w-6" />;
    }
  };

  return (
    <div className="space-y-8 animate-fade-up relative pb-24">
      <div>
        <h2 className="text-responsive-lg font-extrabold tracking-tight text-foreground">Integrations</h2>
        <p className="text-[15px] font-semibold text-muted-foreground mt-2">Connect third-party services to supercharge your academy.</p>
      </div>

      <div className="card-glass p-6 sm:p-8">
        <div className="mb-8 border-b border-border/40 pb-6">
          <h3 className="text-xl font-extrabold tracking-tight flex items-center gap-3 text-foreground">
            <Blocks className="h-5 w-5 text-violet-400" />
            Connected Apps
          </h3>
          <p className="text-sm font-semibold text-muted-foreground mt-2">Manage your active service connections and API keys.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {integrations.map((integration) => {
            const isConnected = integration.status === "connected";

            return (
              <div
                key={integration.id}
                className={cn(
                  "card-glass hover-lift relative rounded-2xl p-6 transition-all duration-300 flex flex-col group overflow-hidden",
                  isConnected
                    ? "border-border/50 hover:border-violet-500/30"
                    : "border-transparent hover:border-border/40"
                )}
              >
                {isConnected && (
                  <div className="absolute top-0 right-0 p-32 bg-violet-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
                )}
                <div className="flex items-start justify-between mb-5 relative z-10">
                  <div className={cn(
                    "h-14 w-14 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110",
                    isConnected
                      ? "bg-violet-500/15 text-violet-400 border border-violet-500/30"
                      : "bg-card/60 text-muted-foreground border border-border/50"
                  )}>
                    {getIcon(integration.icon)}
                  </div>
                  {isConnected ? (
                    <Badge variant="outline" className="h-6 px-2 text-[10px] font-bold uppercase tracking-widest text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="h-6 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-card/60 border border-border/50">Disconnected</Badge>
                  )}
                </div>

                <div className="relative z-10 flex-1">
                  <h3 className="font-extrabold text-[17px] mb-2 text-foreground group-hover:text-violet-400 transition-colors">{integration.name}</h3>
                  <p className="text-[13px] font-medium text-muted-foreground leading-relaxed mb-8">
                    {integration.description}
                  </p>
                </div>

                <div className="relative z-10 flex items-center justify-between mt-auto">
                  {isConnected ? (
                    <Button variant="outline" className="w-full h-10 rounded-xl font-bold tracking-wide text-destructive hover:bg-destructive/10 border-destructive/20 hover:text-destructive bg-destructive/5 transition-all press-scale">
                      Disconnect
                    </Button>
                  ) : (
                    <Button onClick={() => toast.info('Integration coming soon')} className="btn-primary w-full h-10 rounded-xl font-bold tracking-wide transition-all press-scale">
                      Connect <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
}
