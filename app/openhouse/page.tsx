'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getPusherClient } from '@/lib/pusher';
import type PusherClient from 'pusher-js';

type TransitionState = 'none' | 'idle-to-first' | 'last-to-idle';

export default function OpenhouseSlide() {
  const [currentSlide, setCurrentSlide] = useState(-1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionType, setTransitionType] = useState<TransitionState>('none');
  const [slides, setSlides] = useState<any[]>([]);
  const pusherRef = useRef<PusherClient | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [nextSlideQueued, setNextSlideQueued] = useState<number | null>(null);

  useEffect(() => {
    fetch('/data.json')
      .then((res) => res.json())
      .then((data) => setSlides(data))
      .catch((err) => console.error('Error loading slides:', err));

    pusherRef.current = getPusherClient();
    const channel = pusherRef.current.subscribe('slides-channel');

    return () => { channel.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!pusherRef.current) return;
    const channel = pusherRef.current.subscribe('slides-channel');

    const handleSlideChange = (data: { action: string }) => {
      if (data.action === 'next') {
        if (isTransitioning && transitionType !== 'none') skipVideo();
        else handleNext();
      } else if (data.action === 'prev') {
        handlePrev();
      } else if (data.action === 'reset') {
        handleReset();
      } else if (data.action === 'skip') {
        skipVideo();
      }
    };

    channel.bind('slide-change', handleSlideChange);
    return () => { channel.unbind('slide-change', handleSlideChange); };
  }, [slides, currentSlide, isTransitioning, transitionType, nextSlideQueued]);

  const skipVideo = () => {
    if (videoRef.current) videoRef.current.pause();
    handleVideoEnd();
  };

  const handleVideoEnd = () => {
    if (transitionType === 'idle-to-first') {
      setCurrentSlide(nextSlideQueued !== null ? nextSlideQueued : 0);
      setIsTransitioning(false);
      setTransitionType('none');
      setNextSlideQueued(null);
    } else if (transitionType === 'last-to-idle') {
      setCurrentSlide(-1);
      setIsTransitioning(false);
      setTransitionType('none');
      setNextSlideQueued(null);
    }
  };

  const handleNext = () => {
    if (slides.length === 0) return;
    if (isTransitioning) {
      if (transitionType === 'idle-to-first') {
        const queued = nextSlideQueued !== null ? nextSlideQueued : 0;
        if (queued < slides.length - 1) setNextSlideQueued(queued + 1);
      }
      return;
    }
    if (currentSlide === -1) {
      setIsTransitioning(true);
      setTransitionType('idle-to-first');
      setNextSlideQueued(null);
      videoRef.current?.play();
    } else if (currentSlide >= 0 && currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else if (currentSlide === slides.length - 1) {
      setIsTransitioning(true);
      setTransitionType('last-to-idle');
      videoRef.current?.play();
    }
  };

  const handlePrev = () => {
    if (slides.length === 0 || isTransitioning) return;
    if (currentSlide > 0) setCurrentSlide(currentSlide - 1);
    else if (currentSlide === 0) setCurrentSlide(-1);
  };

  const handleReset = () => {
    if (isTransitioning) return;
    setCurrentSlide(-1);
    setTransitionType('none');
  };

  if (isTransitioning && transitionType !== 'none') {
    const videoSrc = transitionType === 'idle-to-first' ? '/videos/intro.mp4' : '/videos/outro.mp4';
    return (
      <div className="relative w-screen h-screen overflow-hidden bg-black cursor-pointer" onClick={skipVideo}>
        <video ref={videoRef} src={videoSrc} className="w-full h-full object-cover" onEnded={handleVideoEnd} autoPlay playsInline />
      </div>
    );
  }

  if (currentSlide === -1) {
    return (
      <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-blue-900 flex items-center justify-center">
        <Link href="/" className="absolute top-4 left-4 z-20 text-white/60 hover:text-white text-sm transition-colors">← Back</Link>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-800/30 via-transparent to-transparent" />
        <div className="absolute top-20 left-20 w-20 h-20 border-4 border-amber-300/30 rounded-lg animate-float" />
        <div className="absolute top-40 right-32 w-16 h-16 border-4 border-blue-300/30 rounded-full animate-float-reverse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-32 left-40 w-24 h-24 border-4 border-purple-300/30 rotate-45 animate-float-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-20 right-20 w-20 h-20 border-4 border-pink-300/30 rounded-lg animate-float" style={{ animationDelay: '0.5s' }} />
        <div className="relative z-10 max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <h1 className="text-7xl font-bold text-white mb-4 drop-shadow-2xl animate-fade-in-out">คณะวิศวกรรมศาสตร์</h1>
            <p className="text-3xl text-amber-200 font-semibold">มหาวิทยาลัยเกษตรศาสตร์</p>
          </div>
          <div className="flex items-center justify-center gap-24">
            <div className="flex flex-col items-center gap-6 transform hover:scale-105 transition-transform duration-300">
              <h2 className="text-5xl font-bold text-amber-300 mb-4 drop-shadow-lg">หลักสูตร CPE</h2>
              <div className="bg-white p-10 rounded-3xl shadow-2xl border-4 border-amber-300 animate-pulse-glow">
                <Image src="/cpe.png" alt="CPE QR Code" width={400} height={400} className="object-contain" priority />
              </div>
              <p className="text-xl text-gray-200 font-medium">วิศวกรรมคอมพิวเตอร์</p>
            </div>
            <div className="flex flex-col items-center gap-6 transform hover:scale-105 transition-transform duration-300">
              <h2 className="text-5xl font-bold text-amber-300 mb-4 drop-shadow-lg">หลักสูตร SKE</h2>
              <div className="bg-white p-10 rounded-3xl shadow-2xl border-4 border-amber-300 animate-pulse-glow" style={{ animationDelay: '1.5s' }}>
                <Image src="/ske.png" alt="SKE QR Code" width={400} height={400} className="object-contain" priority />
              </div>
              <p className="text-xl text-gray-200 font-medium">วิศวกรรมซอฟต์แวร์และความรู้</p>
            </div>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
          <Link href="/openhouse/remote" className="text-white/60 hover:text-white text-sm transition-colors">Remote →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 flex items-center justify-center">
      <Link href="/" className="absolute top-4 left-4 z-20 text-white/60 hover:text-white text-sm transition-colors">← Back</Link>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />
      <div className="absolute top-8 right-8 z-20 bg-black/50 backdrop-blur-sm px-6 py-3 rounded-full border border-white/20">
        <p className="text-white text-lg font-semibold">{currentSlide + 1} / {slides.length}</p>
      </div>
      {slides[currentSlide] && (
        <div className="absolute top-8 left-16 z-20 bg-gradient-to-r from-blue-600/80 to-purple-600/80 backdrop-blur-sm px-8 py-4 rounded-2xl border border-white/30 shadow-2xl">
          <h2 className="text-white text-2xl font-bold drop-shadow-lg">{slides[currentSlide].title}</h2>
        </div>
      )}
      <div className="relative z-10 w-full h-full flex items-center justify-center p-16">
        {slides[currentSlide] && (
          slides[currentSlide].image ? (
            <div className="relative w-full h-full max-w-7xl">
              <Image src={slides[currentSlide].image} alt={slides[currentSlide].title} fill className="object-contain drop-shadow-2xl" priority />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-8 text-center">
              <h1 className="text-8xl font-bold text-white drop-shadow-2xl">{slides[currentSlide].title}</h1>
              {slides[currentSlide].subtitle && (
                <p className="text-5xl text-amber-200 font-semibold drop-shadow-lg">{slides[currentSlide].subtitle}</p>
              )}
            </div>
          )
        )}
      </div>
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20 flex gap-3">
        {slides.map((_: any, index: number) => (
          <div key={index} className={`h-3 rounded-full transition-all duration-300 ${index === currentSlide ? 'w-12 bg-blue-500' : 'w-3 bg-white/30'}`} />
        ))}
      </div>
    </div>
  );
}
