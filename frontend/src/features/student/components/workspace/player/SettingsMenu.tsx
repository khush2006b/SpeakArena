"use client";

import { Settings, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { usePlayerStore } from "@/stores/player.store";

export function SettingsMenu() {
  const { playbackSpeed, setPlaybackSpeed } = usePlayerStore();
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 hover:text-white rounded-full h-10 w-10 transition-colors focus-visible:ring-1 focus-visible:ring-white">
          <Settings className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56 bg-black/90 backdrop-blur-xl border-white/10 text-white rounded-xl shadow-2xl p-2 mb-2">
        
        {/* Playback Speed */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="focus:bg-white/10 data-[state=open]:bg-white/10 rounded-lg cursor-pointer h-10">
            <span className="flex-1">Playback Speed</span>
            <span className="text-xs text-white/50 mr-2">{playbackSpeed === 1 ? "Normal" : `${playbackSpeed}x`}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="bg-black/90 backdrop-blur-xl border-white/10 text-white rounded-xl shadow-2xl p-2 ml-2 min-w-[150px]">
              {speeds.map((speed) => (
                <DropdownMenuItem 
                  key={speed} 
                  onClick={() => setPlaybackSpeed(speed)}
                  className="focus:bg-white/10 rounded-lg cursor-pointer h-9"
                >
                  <span className="w-6 flex items-center justify-center">
                    {playbackSpeed === speed && <Check className="h-4 w-4" />}
                  </span>
                  {speed === 1 ? "Normal" : `${speed}x`}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuSeparator className="bg-white/10" />

        {/* Quality (UI Only) */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="focus:bg-white/10 data-[state=open]:bg-white/10 rounded-lg cursor-pointer h-10">
            <span className="flex-1">Quality</span>
            <span className="text-xs text-white/50 mr-2">Auto (1080p)</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="bg-black/90 backdrop-blur-xl border-white/10 text-white rounded-xl shadow-2xl p-2 ml-2 min-w-[150px]">
              <DropdownMenuItem className="focus:bg-white/10 rounded-lg cursor-pointer h-9">
                <span className="w-6 flex items-center justify-center"><Check className="h-4 w-4" /></span> Auto
              </DropdownMenuItem>
              <DropdownMenuItem className="focus:bg-white/10 rounded-lg cursor-pointer h-9">
                <span className="w-6" /> 1080p HD
              </DropdownMenuItem>
              <DropdownMenuItem className="focus:bg-white/10 rounded-lg cursor-pointer h-9">
                <span className="w-6" /> 720p
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* Subtitles (UI Only) */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="focus:bg-white/10 data-[state=open]:bg-white/10 rounded-lg cursor-pointer h-10">
            <span className="flex-1">Subtitles/CC</span>
            <span className="text-xs text-white/50 mr-2">Off</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="bg-black/90 backdrop-blur-xl border-white/10 text-white rounded-xl shadow-2xl p-2 ml-2 min-w-[150px]">
              <DropdownMenuItem className="focus:bg-white/10 rounded-lg cursor-pointer h-9">
                <span className="w-6 flex items-center justify-center"><Check className="h-4 w-4" /></span> Off
              </DropdownMenuItem>
              <DropdownMenuItem className="focus:bg-white/10 rounded-lg cursor-pointer h-9">
                <span className="w-6" /> English (Auto-generated)
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

      </DropdownMenuContent>
    </DropdownMenu>
  );
}
