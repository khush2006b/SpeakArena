"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings, User, CreditCard } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function TeacherProfileMenu() {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const user = useAuthStore((s) => s.user);
  const clearUser = useAuthStore((s) => s.clearUser);

  const teacherName = user?.fullName || (user as any)?.full_name || "Paras (Construction)";
  const teacherEmail = user?.email || "teacher@speakarena.com";
  const initials = teacherName
    ? teacherName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "PC";

  const handleLogout = () => {
    clearUser();
    router.push(ROUTES.LOGIN);
  };

  return (
    <div className="relative z-[100]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full bg-transparent border-none outline-none cursor-pointer transition-transform hover:scale-105 press-scale"
      >
        <Avatar className="h-9 w-9 border border-border">
          <AvatarImage src={user?.avatarUrl || (user as any)?.avatar_url || "/images/paras_teacher.png"} alt={teacherName} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[99]"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-[calc(100%+8px)] w-60 bg-card/95 backdrop-blur-2xl border border-border/60 rounded-xl p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] flex flex-col gap-1 animate-fade-up">
            <div className="px-3 py-2 border-b border-border/50 mb-1">
              <p className="text-sm font-bold text-foreground truncate">{teacherName}</p>
              <p className="text-xs text-muted-foreground truncate">{teacherEmail}</p>
            </div>

            <div className="flex flex-col gap-0.5">
              <Link href="/teacher/profile" onClick={() => setIsOpen(false)} className={menuItemClass}>
                <User className="w-4 h-4" />
                <span>Profile</span>
              </Link>
              <Link href="/teacher/settings" onClick={() => setIsOpen(false)} className={menuItemClass}>
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </Link>
              <Link href="/teacher/finance" onClick={() => setIsOpen(false)} className={menuItemClass}>
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
