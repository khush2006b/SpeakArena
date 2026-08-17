"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings, User, CreditCard } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

export function TeacherProfileMenu() {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);

  const handleLogout = () => {
    router.push(ROUTES.LOGIN);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full bg-transparent border-none outline-none cursor-pointer transition-transform hover:scale-105 press-scale"
      >
        <div className="h-9 w-9 rounded-full border border-border overflow-hidden bg-violet-500/10 flex items-center justify-center text-violet-400 font-semibold text-sm relative">
          <img
            src="https://github.com/shadcn.png"
            alt="Teacher Avatar"
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          <span className="absolute">JD</span>
        </div>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-[calc(100%+8px)] w-56 bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl p-2 shadow-2xl z-50 flex flex-col gap-1 animate-fade-up">
            <div className="px-3 py-2 border-b border-border/50 mb-1">
              <p className="text-sm font-semibold text-foreground">John Doe</p>
              <p className="text-xs text-muted-foreground">john.doe@speakarena.com</p>
            </div>

            <div className="flex flex-col gap-0.5">
              <Link href="/teacher/profile" className={menuItemClass}>
                <User className="w-4 h-4" />
                <span>Profile</span>
              </Link>
              <Link href="/teacher/settings" className={menuItemClass}>
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </Link>
              <Link href="/teacher/billing" className={menuItemClass}>
                <CreditCard className="w-4 h-4" />
                <span>Billing</span>
              </Link>
            </div>

            <div className="h-px bg-border/50 my-1" />

            <button
              onClick={handleLogout}
              className={cn(menuItemClass, "text-destructive hover:bg-destructive/10 hover:text-destructive w-full text-left")}
            >
              <LogOut className="w-4 h-4" />
              <span>Log out</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const menuItemClass =
  "flex items-center gap-3 px-3 py-2 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-white/5 rounded-lg transition-colors no-underline press-scale";
