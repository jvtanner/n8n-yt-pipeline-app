'use client';

import ThumbnailImageStudio from '@/components/ThumbnailImageStudio';

export default function ThumbnailTestPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">Thumbnail Test</h1>
        <p className="text-sm text-zinc-500 mb-8">Test thumbnail generation without running the full pipeline.</p>

        <ThumbnailImageStudio
          creatorName="Josh Tanner"
          chosenThumbnailText="TEST THUMBNAIL"
          onComplete={(url) => {
            console.log('Generated thumbnail:', url);
            alert('Thumbnail generated: ' + url);
          }}
          onSkip={() => {
            console.log('Skipped');
          }}
        />
      </div>
    </div>
  );
}
