import React, { useEffect, useRef, useState } from 'react';
import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid';
import { ProgressBar } from './ProgressBar';

interface AudioTranscript {
  srt: string;
  vtt: string;
  json: {
    subtitles: Array<{
      text: string;
      start: number;
      end: number;
      words?: Array<{
        text: string;
        start: number;
        end: number;
        confidence: number;
        speaker?: string | null;
      }>;
      speaker?: string | null;
    }>;
  };
}

interface SimpleAudioPlayerProps {
  audioUrl: string;
  transcript?: AudioTranscript;
  onPlay?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
}

export const SimpleAudioPlayer: React.FC<SimpleAudioPlayerProps> = ({
  audioUrl,
  transcript,
  onPlay,
  onTimeUpdate,
  onEnded,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [onTimeUpdate, onEnded]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
      onPlay?.();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = time;
    setCurrentTime(time);
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center space-x-4 w-full max-w-md p-4 bg-white rounded-lg shadow">
      <button
        onClick={togglePlayPause}
        className="w-10 h-10 flex items-center justify-center bg-blue-500 hover:bg-blue-600 rounded-full text-white focus:outline-none"
      >
        {isPlaying ? (
          <PauseIcon className="w-5 h-5" />
        ) : (
          <PlayIcon className="w-5 h-5" />
        )}
      </button>
      <div className="flex-1">
        <ProgressBar
          ref={progressBarRef}
          progress={progress}
          duration={duration}
          currentTime={currentTime}
          onSeek={handleSeek}
        />
      </div>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
    </div>
  );
};
