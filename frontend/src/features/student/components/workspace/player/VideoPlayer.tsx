"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { usePlayerStore } from "@/stores/player.store";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { VideoControls } from "./VideoControls";
import { NextLessonOverlay } from "./NextLessonOverlay";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  onLessonComplete?: () => void;
  nextLessonTitle?: string;
}

export function VideoPlayer({ src, poster, onLessonComplete, nextLessonTitle }: VideoPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  const [showNextOverlay, setShowNextOverlay] = React.useState(false);
  const [countdown, setCountdown] = React.useState(10);
  const countdownIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  const [isBrowserFullscreen, setIsBrowserFullscreen] = React.useState(false);
  // "Theater mode" just triggers right sidebar collapse and possibly widens the center area.
  const [isTheaterMode, setIsTheaterMode] = React.useState(false);
  
  const { isRightSidebarOpen, toggleRightSidebar } = useWorkspaceStore();

  const {
    isPlaying,
    setIsPlaying,
    togglePlayPause,
    setCurrentTime,
    setDuration,
    volume,
    isMuted,
    playbackSpeed,
    isBuffering,
    setIsBuffering,
    showControls,
    setShowControls,
  } = usePlayerStore();

  const controlsTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Sync state to Video Element
  React.useEffect(() => {
    if (videoRef.current) {
      if (isPlaying && videoRef.current.paused) {
        videoRef.current.play().catch(e => console.warn("Autoplay blocked:", e));
      } else if (!isPlaying && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  React.useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  React.useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Video Event Handlers
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    setCurrentTime(time);
    
    // Trigger next lesson overlay in last 10 seconds if a next lesson exists
    if (videoRef.current.duration > 0 && nextLessonTitle) {
      const remaining = videoRef.current.duration - time;
      if (remaining <= 10 && remaining > 0 && !showNextOverlay) {
        setShowNextOverlay(true);
        startCountdown();
      } else if (remaining > 10 && showNextOverlay) {
        setShowNextOverlay(false);
        clearCountdown();
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
    if (onLessonComplete) onLessonComplete();
  };

  // Seeking Logic
  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleSkip = (amount: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += amount;
    }
  };

  // Custom Event Listener for Bookmarks/Notes
  React.useEffect(() => {
    const handleSeekTo = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      handleSeek(customEvent.detail);
    };
    window.addEventListener('seekTo', handleSeekTo);
    return () => window.removeEventListener('seekTo', handleSeekTo);
  }, []);

  // Controls Visibility
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2500);
    }
  };

  const handleMouseLeave = () => {
    if (isPlaying) {
      setShowControls(false);
    }
  };

  // Keyboard Shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      switch(e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'j':
        case 'arrowleft':
          e.preventDefault();
          handleSkip(-10);
          break;
        case 'l':
        case 'arrowright':
          e.preventDefault();
          handleSkip(10);
          break;
        case 'f':
          e.preventDefault();
          toggleBrowserFullscreen();
          break;
        case 't':
          e.preventDefault();
          toggleTheaterMode();
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause]);

  // Fullscreen / Theater Handlers
  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => console.error(err));
      setIsBrowserFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsBrowserFullscreen(false);
    }
  };

  const toggleTheaterMode = () => {
    setIsTheaterMode(!isTheaterMode);
    // Collapse right sidebar if turning on theater mode and it's open
    if (!isTheaterMode && isRightSidebarOpen) toggleRightSidebar();
    // Expand right sidebar if turning off theater mode and it was closed
    if (isTheaterMode && !isRightSidebarOpen) toggleRightSidebar();
  };

  // Countdown Logic for Next Overlay
  const startCountdown = () => {
    setCountdown(10);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearCountdown();
          if (onLessonComplete) onLessonComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const clearCountdown = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  };

  React.useEffect(() => {
    return () => clearCountdown(); // Cleanup
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`relative w-full bg-black group flex flex-col justify-center overflow-hidden transition-all duration-500 ${isBrowserFullscreen ? 'h-screen' : 'aspect-video'}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => !showNextOverlay && togglePlayPause()}
      onDoubleClick={toggleBrowserFullscreen}
    >
      {/* Loading Overlay */}
      {isBuffering && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
        </div>
      )}

      {/* Video Element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full object-contain cursor-pointer"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleVideoEnd}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        playsInline
      />

      {/* Next Lesson Overlay */}
      {showNextOverlay && nextLessonTitle && (
        <NextLessonOverlay 
          countdown={countdown}
          nextLessonTitle={nextLessonTitle}
          onCancel={() => {
            setShowNextOverlay(false);
            clearCountdown();
          }}
          onPlayNext={() => {
            clearCountdown();
            if (onLessonComplete) onLessonComplete();
          }}
        />
      )}

      {/* Controls Overlay */}
      <div 
        className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="absolute inset-0 pointer-events-auto" onClick={(e) => { e.stopPropagation(); togglePlayPause(); }} />
        
        <div className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          <VideoControls 
            onSeek={handleSeek}
            onSkip={handleSkip}
            toggleTheaterMode={toggleTheaterMode}
            isTheaterMode={isTheaterMode}
            toggleBrowserFullscreen={toggleBrowserFullscreen}
            isBrowserFullscreen={isBrowserFullscreen}
          />
        </div>
      </div>

    </div>
  );
}
