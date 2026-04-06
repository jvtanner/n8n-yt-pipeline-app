'use client';

import { useState, useCallback, useRef } from 'react';

const CLOUD_NAME = 'djzc7ujug';
const UPLOAD_PRESET = 'ml_default';

interface ImageDropZoneProps {
  label?: string;
  onUploaded: (cloudinaryUrl: string) => void;
}

export default function ImageDropZone({ label, onUploaded }: ImageDropZoneProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadToCloudinary = useCallback(async (body: FormData) => {
    setUploading(true);
    setError(null);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Upload failed');
      }
      const data = await res.json();
      setPreview(data.secure_url);
      onUploaded(data.secure_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [onUploaded]);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', 'yt-thumbnails');
    await uploadToCloudinary(formData);
  }, [uploadToCloudinary]);

  const uploadUrl = useCallback(async (url: string) => {
    const formData = new FormData();
    formData.append('file', url);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', 'yt-thumbnails');
    await uploadToCloudinary(formData);
  }, [uploadToCloudinary]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      uploadFile(file);
    }
  }, [uploadFile]);

  const handleUrlSubmit = useCallback(() => {
    const trimmed = urlInput.trim();
    if (trimmed) uploadUrl(trimmed);
  }, [urlInput, uploadUrl]);

  const clear = useCallback(() => {
    setPreview(null);
    setUrlInput('');
    setError(null);
  }, []);

  if (preview) {
    return (
      <div className="space-y-2">
        {label && <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>}
        <div className="relative rounded-xl border border-zinc-800 overflow-hidden">
          <img src={preview} alt="Uploaded" className="w-full aspect-video object-cover" />
          <button
            onClick={clear}
            className="absolute top-2 right-2 rounded-full bg-zinc-900/80 p-1.5 text-zinc-400 hover:text-white transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-all ${
          dragOver
            ? 'border-orange-500 bg-orange-500/5'
            : 'border-zinc-700 hover:border-zinc-600 bg-zinc-900/50'
        }`}
      >
        {uploading ? (
          <>
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-orange-500" />
            <p className="text-sm text-zinc-500">Uploading...</p>
          </>
        ) : (
          <>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="text-sm text-zinc-500">Drop an image or click to browse</p>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file);
          }}
        />
      </div>

      {/* URL input */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Or paste an image URL"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleUrlSubmit(); }}
          className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600"
        />
        <button
          onClick={handleUrlSubmit}
          disabled={!urlInput.trim() || uploading}
          className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
        >
          Upload
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
