'use client';

import Link from 'next/link';
import { triggerSlideChange } from '@/lib/pusher';

export default function Remote() {
  const handleReset = () => triggerSlideChange('reset').catch(console.error);
  const handleNext = () => triggerSlideChange('next').catch(console.error);
  const handlePrev = () => triggerSlideChange('prev').catch(console.error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <Link href="/openhouse" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors block mb-4">
              ← Slide View
            </Link>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Remote Control</h1>
          </div>

          <div className="space-y-4">
            <button onClick={handleReset} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 active:scale-95 shadow-lg">
              ↺ Reset to Idle
            </button>
            <button onClick={handlePrev} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 active:scale-95 shadow-lg">
              ← Previous Slide
            </button>
            <button onClick={handleNext} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 active:scale-95 shadow-lg">
              Next Slide →
            </button>
          </div>

          <div className="mt-8 p-4 bg-gray-50 dark:bg-slate-700 rounded-xl">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              KU Engineering Open House 2025
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
