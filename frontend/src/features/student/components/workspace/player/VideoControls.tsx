"use client";

import * as React from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward, RectangleHorizontal } from "lucide-react";
import { usePlayerStore } from "@/stores/player.store";
import { formatTime } from "@/lib/format-time";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { SettingsMenu } from "./SettingsMenu";

interface VideoControlsProps {
  onSeek: (time: number) => void;
  onSkip: (amount: number) => void;
  toggleTheaterMode: () => void;
  isTheaterMode: boolean;
  toggleBrowserFullscreen: () => void;
  isBrowserFullscreen: boolean;
}

export function VideoControls({ onSeek, onSkip, toggleTheaterMode, isTheaterMode, toggleBrowserFullscreen, isBrowserFullscreen }: VideoControlsProps) {
  const { 
    isPlaying, 
    togglePlayPause, 
    currentTime, 
    duration, 
    volume, 
    setVolume, 
    isMuted, 
    toggleMute 
  } = usePlayerStore();

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
  };

  const handleSeek = (value: number[]) => {
    onSeek(value[0]);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-16 pb-2 px-4 transition-opacity duration-300">
      
      {/* Progress Bar */}
      <div className="flex items-center gap-2 mb-2 group cursor-pointer h-5">
        <Slider 
          value={[currentTime]} 
          max={duration || 100} 
          step={1} 
          onValueChange={handleSeek}
          className="cursor-pointer"
        />
      </div>

      <div className="flex items-center justify-between">
        
        {/* Left Controls */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={togglePlayPause} className="text-white hover:bg-white/20 hover:text-white rounded-full h-10 w-10">
            {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-1" />}
          </Button>

          <Button variant="ghost" size="icon" onClick={() => onSkip(-10)} className="text-white hover:bg-white/20 hover:text-white rounded-full h-10 w-10">
            <SkipBack className="h-5 w-5" />
          </Button>

          <Button variant="ghost" size="icon" onClick={() => onSkip(10)} className="text-white hover:bg-white/20 hover:text-white rounded-full h-10 w-10">
            <SkipForward className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2 ml-2 group relative">
            <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white hover:bg-white/20 hover:text-white rounded-full h-10 w-10">
              {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>
            {/* Hover Volume Slider */}
            <div className="w-0 overflow-hidden group-hover:w-20 transition-all duration-300 flex items-center h-full">
              <Slider 
                value={[isMuted ? 0 : volume]} 
                max={1} 
                step={0.05} 
                onValueChange={handleVolumeChange} 
                className="w-20"
              />
            </div>
          </div>

          <div className="text-white text-sm font-medium ml-4 font-mono tracking-tighter">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          
          <SettingsMenu />

          <Button variant="ghost" size="icon" onClick={toggleTheaterMode} className="text-white hover:bg-white/20 hover:text-white rounded-full h-10 w-10 hidden sm:flex">
            <RectangleHorizontal className={`h-5 w-5 ${isTheaterMode ? "fill-white/20" : ""}`} />
          </Button>

          <Button variant="ghost" size="icon" onClick={toggleBrowserFullscreen} className="text-white hover:bg-white/20 hover:text-white rounded-full h-10 w-10">
            {isBrowserFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </Button>

        </div>
      </div>
    </div>
  );
}
