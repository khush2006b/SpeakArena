"use client";

import * as React from "react";
import Link from "next/link";
import { User, Settings, LogOut, Award } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { apiClient } from "@/services/api/client";
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
  const [profile, setProfile] = React.useState<any>(null);

  React.useEffect(() => {
    async function loadData() {
      try {
        const res = await apiClient.get('/api/v1/profile');
        setProfile(res.data);
      } catch (err) {
        console.error("Failed to load profile for menu", err);
      }
    }
    loadData();
  }, []);

  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "S";

  const streak = profile?.streak_days || 0;
  const goal = profile?.weekly_goal || 7;
  const progressPercent = Math.min(100, Math.round((streak / goal) * 100));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9 transition-transform active:scale-95 border-border border">
            <AvatarImage src={user?.avatarUrl || undefined} alt={user?.fullName || "Student"} />
            <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 bg-card border-border border" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            <p className="text-sm font-medium leading-none text-foreground">{user?.fullName || "Student Name"}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email || "student@example.com"}
            </p>
            
            {/* Student specific: Quick Progress/Streak Snapshot */}
            <div className="mt-3 rounded-md p-3 bg-white/5 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <Award className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-semibold text-foreground">{streak} Day Streak!</span>
              </div>
              <div className="w-full rounded-full h-1.5 mt-2 overflow-hidden bg-white/5">
                <div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${progressPercent}%` }} />
              </div>
              <p className="text-[10px] mt-1 text-right text-muted-foreground">{progressPercent}% to Weekly Goal</p>
            </div>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator className="bg-white/10" />
        
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="focus:bg-white/5 cursor-pointer">
            <Link href="/student/profile" className="flex items-center text-foreground">
              <User className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>My Profile</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="focus:bg-white/5 cursor-pointer">
            <Link href="/student/settings" className="flex items-center text-foreground">
              <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        
        <DropdownMenuSeparator className="bg-white/10" />
        
        <DropdownMenuItem onClick={() => clearUser()} className="focus:bg-red-500/10 cursor-pointer text-red-500">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
