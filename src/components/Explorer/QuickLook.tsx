import React, { useState, useEffect, useCallback } from 'react';
import { useExplorerStore } from '../../store/explorerStore';
import { motion, AnimatePresence } from 'framer-motion';
import { X, File, Music, ExternalLink, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { readFile } from '@tauri-apps/plugin-fs';

interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

const QuickLook: React.FC = () => {
  const { quickLookFile, setQuickLookFile } = useExplorerStore();
  const [content, setContent] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | 'audio' | 'text' | 'other'>('other');
  // B15: siblings in the same folder, for arrow-key navigation.
  const [siblings, setSiblings] = useState<DirEntry[]>([]);
  // B16: image load failure flag for corrupted/unsupported images.
  const [imgError, setImgError] = useState(false);

  // Reset transient UI state whenever the previewed file changes.
  useEffect(() => {
    setImgError(false);
    if (!quickLookFile) {
      setContent(null);
      setSiblings([]);
      return;
    }

    const ext = quickLookFile.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
      setFileType('image');
    } else if (['mp4', 'avi', 'mkv', 'mov', 'webm'].includes(ext)) {
      setFileType('video');
    } else if (['mp3', 'flac', 'wav', 'ogg', 'm4a'].includes(ext)) {
      setFileType('audio');
    } else if (['txt', 'log', 'md', 'json', 'xml', 'csv', 'js', 'ts', 'py', 'html', 'css', 'rs', 'toml'].includes(ext)) {
      setFileType('text');
      // Load text content
      const loadText = async () => {
        try {
          const data = await readFile(quickLookFile);
          const text = new TextDecoder().decode(data.slice(0, 10000)); // First 10KB
          setContent(text);
        } catch (e) {
          setContent('Failed to load text content.');
        }
      };
      loadText();
    } else {
      setFileType('other');
    }

    // B15: load sibling files (same directory) to enable prev/next navigation.
    // Only files (not dirs) are navigable. Failures are non-fatal — nav just
    // won't be available.
    const loadSiblings = async () => {
      try {
        const sep = quickLookFile.lastIndexOf('\\');
        const dir = sep >= 0 ? quickLookFile.slice(0, sep) : quickLookFile;
        const entries = await invoke<DirEntry[]>('read_dir', { path: dir });
        setSiblings(entries.filter((e) => !e.is_dir));
      } catch {
        setSiblings([]);
      }
    };
    loadSiblings();
  }, [quickLookFile]);

  // B15: index of the current file within siblings.
  const currentIndex = siblings.findIndex((s) => s.path === quickLookFile);
  const canNavigate = siblings.length > 1 && currentIndex >= 0;

  const goPrev = useCallback(() => {
    if (!canNavigate) return;
    const prev = siblings[(currentIndex - 1 + siblings.length) % siblings.length];
    setQuickLookFile(prev.path);
  }, [canNavigate, currentIndex, siblings, setQuickLookFile]);

  const goNext = useCallback(() => {
    if (!canNavigate) return;
    const next = siblings[(currentIndex + 1) % siblings.length];
    setQuickLookFile(next.path);
  }, [canNavigate, currentIndex, siblings, setQuickLookFile]);

  // B15: keyboard arrow navigation while QuickLook is open.
  useEffect(() => {
    if (!quickLookFile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [quickLookFile, goPrev, goNext]);

  if (!quickLookFile) return null;

  const fileName = quickLookFile.split('\\').pop() || '';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/80 backdrop-blur-sm"
        onClick={() => setQuickLookFile(null)}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative max-w-5xl w-full max-h-full bg-bg-secondary rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-border"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg-tertiary">
            <div className="flex items-center gap-3">
              <button onClick={() => setQuickLookFile(null)} className="p-2 hover:bg-bg-hover rounded-full transition-colors text-text-secondary hover:text-text-primary">
                <X size={20} />
              </button>
              <h2 className="text-sm font-bold truncate max-w-md">{fileName}</h2>
            </div>
            <div className="flex items-center gap-2">
              {/* B15: prev/next nav buttons */}
              {canNavigate && (
                <div className="flex items-center gap-1 mr-2">
                  <button
                    onClick={goPrev}
                    className="p-2 hover:bg-bg-hover rounded-full transition-colors text-text-secondary hover:text-text-primary"
                    title="Previous (Left Arrow)"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="text-[10px] text-text-muted font-mono px-1">
                    {currentIndex + 1} / {siblings.length}
                  </span>
                  <button
                    onClick={goNext}
                    className="p-2 hover:bg-bg-hover rounded-full transition-colors text-text-secondary hover:text-text-primary"
                    title="Next (Right Arrow)"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
              <button className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-xs font-bold hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20">
                <ExternalLink size={14} />
                Open
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-bg-primary/50 relative">
            {fileType === 'image' && (
              // B16: onError fallback replaces broken-image icon with a clear
              // "couldn't be previewed" message instead of the browser default.
              imgError ? (
                <div className="flex flex-col items-center gap-4 text-text-muted">
                  <AlertCircle size={64} strokeWidth={1} className="text-error/60" />
                  <p className="text-sm font-medium">Couldn't preview this image — it may be corrupted or unsupported.</p>
                </div>
              ) : (
                <img
                  src={convertFileSrc(quickLookFile)}
                  alt={fileName}
                  onError={() => setImgError(true)}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-xl"
                />
              )
            )}
            {fileType === 'video' && (
              <video
                src={convertFileSrc(quickLookFile)}
                controls
                autoPlay
                className="max-w-full max-h-[70vh] rounded-lg shadow-xl"
              />
            )}
            {fileType === 'audio' && (
              <div className="flex flex-col items-center gap-6 p-12">
                <div className="w-32 h-32 bg-accent/10 text-accent rounded-full flex items-center justify-center">
                  <Music size={64} />
                </div>
                <audio src={convertFileSrc(quickLookFile)} controls autoPlay className="w-80" />
              </div>
            )}
            {fileType === 'text' && (
              <pre className="w-full h-full p-8 font-mono text-xs text-text-primary whitespace-pre-wrap overflow-auto selection:bg-accent/30">
                {content}
              </pre>
            )}
            {fileType === 'other' && (
              <div className="flex flex-col items-center gap-4 text-text-muted">
                <File size={64} strokeWidth={1} />
                <p className="text-sm font-medium">No preview available for this file type.</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-border bg-bg-tertiary/50 text-[10px] text-text-muted flex justify-between items-center">
             <span>QuickLook v1.0</span>
             <span>Press Esc to close{canNavigate ? ' · ← → to navigate' : ''}</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default QuickLook;
