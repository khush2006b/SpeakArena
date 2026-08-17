"use client";

import * as React from "react";
import Link from "next/link";
import { User, Settings, LogOut, Award } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function ProfileMenu() {
  const { user, clearUser } = useAuthStore();

  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "S";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9 transition-transform active:scale-95" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <AvatarImage src={user?.avatarUrl || undefined} alt={user?.fullName || "Student"} />
            <AvatarFallback style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end" forceMount style={{ background: "#0b0e18", border: "1px solid rgba(255,255,255,0.07)" }}>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            <p className="text-sm font-medium leading-none" style={{ color: "#fff" }}>{user?.fullName || "Student Name"}</p>
            <p className="text-xs leading-none" style={{ color: "#9ca3af" }}>
              {user?.email || "student@example.com"}
            </p>
            
            {/* Student specific: Quick Progress/Streak Snapshot */}
            <div className="mt-3 rounded-md p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-2 mb-1">
                <Award className="h-4 w-4" style={{ color: "#f59e0b" }} />
                <span className="text-xs font-semibold" style={{ color: "#e5e7eb" }}>5 Day Streak!</span>
              </div>
              <div className="w-full rounded-full h-1.5 mt-2 overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="h-1.5 rounded-full w-[70%]" style={{ background: "#f59e0b" }} />
              </div>
              <p className="text-[10px] mt-1 text-right" style={{ color: "#6b7280" }}>70% to Weekly Goal</p>
            </div>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator style={{ background: "rgba(255,255,255,0.07)" }} />
        
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="focus:bg-white/5 cursor-pointer">
            <Link href="/student/profile" className="flex items-center" style={{ color: "#e5e7eb" }}>
              <User className="mr-2 h-4 w-4" style={{ color: "#9ca3af" }} />
              <span>My Profile</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="focus:bg-white/5 cursor-pointer">
            <Link href="/student/settings" className="flex items-center" style={{ color: "#e5e7eb" }}>
              <Settings className="mr-2 h-4 w-4" style={{ color: "#9ca3af" }} />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        
        <DropdownMenuSeparator style={{ background: "rgba(255,255,255,0.07)" }} />
        
        <DropdownMenuItem onClick={() => clearUser()} className="focus:bg-red-500/10 cursor-pointer" style={{ color: "#ef4444" }}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
