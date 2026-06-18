import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface InputDialogProps {
  isOpen: boolean;
  title: string;
  defaultValue?: string;
  placeholder?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/**
 * Reusable input dialog — replaces all blocking window.prompt() calls.
 * Matches NexExplorer's glass-card design language from HashChecker.tsx.
 * - Auto-focuses and selects input text on open
 * - Enter to confirm, Escape to cancel
 * - Framer Motion animated backdrop + panel
 */
const InputDialog: React.FC<InputDialogProps> = ({
  isOpen,
  title,
  defaultValue = '',
  placeholder = '',
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset value and auto-focus when dialog opens
  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      // Small delay so the DOM element is mounted before focusing
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isOpen, defaultValue]);

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onConfirm(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="bg-bg-secondary w-full max-w-sm rounded-2xl shadow-2xl border border-border overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-border bg-bg-tertiary flex items-center justify-between">
              <h3 className="font-bold text-sm text-text-primary">{title}</h3>
              <button
                onClick={onCancel}
                className="text-text-secondary hover:text-text-primary transition-colors p-1 rounded-lg hover:bg-bg-hover"
              >
                <X size={16} />
              </button>
            </div>

            {/* Input */}
            <div className="p-5">
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full bg-bg-primary border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-all placeholder:text-text-muted/50"
              />
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-bg-tertiary border-t border-border flex justify-end gap-2">
              <button
                onClick={onCancel}
                className="px-4 py-1.5 bg-bg-secondary hover:bg-bg-hover border border-border rounded-lg text-xs font-bold transition-colors text-text-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-accent/20"
              >
                OK
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InputDialog;
