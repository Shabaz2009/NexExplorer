import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, Moon, Sun, Monitor, Palette, Zap, Shield, Eye, EyeOff, Layout, MousePointer, Trash2, FolderOpen, Gauge, Wifi } from 'lucide-react';
import { useSettingsStore, AccentColor } from '../../store/settingsStore';
import { motion, AnimatePresence } from 'framer-motion';

const accentColors: { id: AccentColor; label: string; css: string; ring: string }[] = [
  { id: 'indigo', label: 'Indigo', css: 'bg-indigo-500', ring: 'ring-indigo-500' },
  { id: 'cyan', label: 'Cyan', css: 'bg-cyan-500', ring: 'ring-cyan-500' },
  { id: 'emerald', label: 'Emerald', css: 'bg-emerald-500', ring: 'ring-emerald-500' },
  { id: 'rose', label: 'Rose', css: 'bg-rose-500', ring: 'ring-rose-500' },
  { id: 'amber', label: 'Amber', css: 'bg-amber-500', ring: 'ring-amber-500' },
  { id: 'violet', label: 'Violet', css: 'bg-violet-500', ring: 'ring-violet-500' },
];

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  icon?: React.ReactNode;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, description, checked, onChange, icon }) => (
  <div className="flex items-center justify-between py-3 px-1 group">
    <div className="flex items-center gap-3">
      {icon && <div className="text-text-muted group-hover:text-accent transition-colors">{icon}</div>}
      <div>
        <div className="text-[13px] font-medium text-text-primary">{label}</div>
        {description && <div className="text-[11px] text-text-muted mt-0.5">{description}</div>}
      </div>
    </div>
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
        checked ? 'bg-accent' : 'bg-bg-tertiary border border-border'
      }`}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ${
        checked ? 'translate-x-5' : 'translate-x-0.5'
      }`} />
    </button>
  </div>
);

const SettingsPanel: React.FC = () => {
  const {
    isSettingsOpen, closeSettings,
    theme, setTheme,
    accentColor, setAccentColor,
    fontSize, setFontSize,
    compactMode, setCompactMode,
    disableAnimations, setDisableAnimations,
    doubleClickToOpen, setDoubleClickToOpen,
    confirmDelete, setConfirmDelete,
    rememberLastLocation, setRememberLastLocation,
    disableThumbnails, setDisableThumbnails,
    disablePreviews, setDisablePreviews,
    maxFilesBeforePaginate, setMaxFilesBeforePaginate,
    shellIntegration, setShellIntegration,
  } = useSettingsStore();

  return (
    <AnimatePresence>
      {isSettingsOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
            onClick={closeSettings}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-[420px] max-w-[90vw] bg-bg-secondary/95 backdrop-blur-xl border-l border-border z-[101] flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/5 shadow-lg shadow-accent/10">
                  <img src="/logo.png" alt="" className="w-full h-full object-cover" />
                </div>
                <h2 className="text-base font-bold text-text-primary tracking-tight">Settings</h2>
              </div>
              <button
                onClick={closeSettings}
                className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-6">

              {/* ─── THEME ───────────────────── */}
              <section>
                <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Palette size={12} /> Appearance
                </h3>

                {/* Theme Selector */}
                <div className="mb-4">
                  <div className="text-[12px] font-medium text-text-secondary mb-2">Theme</div>
                  <div className="flex gap-2">
                    {([
                      { value: 'dark' as const, icon: <Moon size={14} />, label: 'Dark' },
                      { value: 'light' as const, icon: <Sun size={14} />, label: 'Light' },
                      { value: 'system' as const, icon: <Monitor size={14} />, label: 'System' },
                    ]).map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setTheme(t.value)}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-all ${
                          theme === t.value
                            ? 'bg-accent text-white shadow-lg shadow-accent/20'
                            : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover hover:text-text-primary border border-border/50'
                        }`}
                      >
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Accent Color */}
                <div className="mb-4">
                  <div className="text-[12px] font-medium text-text-secondary mb-2">Accent Color</div>
                  <div className="flex gap-2">
                    {accentColors.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setAccentColor(c.id)}
                        className={`w-8 h-8 rounded-full ${c.css} transition-all hover:scale-110 ${
                          accentColor === c.id ? `ring-2 ${c.ring} ring-offset-2 ring-offset-bg-secondary scale-110` : 'opacity-60 hover:opacity-100'
                        }`}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Font Size */}
                <div className="mb-4">
                  <div className="text-[12px] font-medium text-text-secondary mb-2">Font Size</div>
                  <div className="flex gap-2">
                    {(['small', 'medium', 'large'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setFontSize(s)}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-[12px] font-medium capitalize transition-all ${
                          fontSize === s
                            ? 'bg-accent/20 text-accent border border-accent/30'
                            : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover border border-transparent'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <ToggleRow
                  label="Compact Mode"
                  description="Reduce spacing and padding"
                  checked={compactMode}
                  onChange={setCompactMode}
                  icon={<Layout size={16} />}
                />

                <ToggleRow
                  label="Disable Animations"
                  description="Reduce motion for low-end devices"
                  checked={disableAnimations}
                  onChange={setDisableAnimations}
                  icon={<Zap size={16} />}
                />
              </section>

              <div className="h-px bg-border" />

              {/* ─── BEHAVIOR ────────────────── */}
              <section>
                <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                  <MousePointer size={12} /> Behavior
                </h3>

                <ToggleRow
                  label="Double-click to open"
                  description="Single-click selects, double-click opens"
                  checked={doubleClickToOpen}
                  onChange={setDoubleClickToOpen}
                  icon={<MousePointer size={16} />}
                />

                <ToggleRow
                  label="Confirm before delete"
                  description="Show warning dialog before deleting files"
                  checked={confirmDelete}
                  onChange={setConfirmDelete}
                  icon={<Trash2 size={16} />}
                />

                <ToggleRow
                  label="Remember last location"
                  description="Open last folder on startup"
                  checked={rememberLastLocation}
                  onChange={setRememberLastLocation}
                  icon={<FolderOpen size={16} />}
                />
              </section>

              <div className="h-px bg-border" />

              {/* ─── NEXDROP ─────────────────── */}
              <section>
                <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Wifi size={12} /> NexDrop
                </h3>

                <div className="py-3 px-1">
                  <div className="text-[13px] font-medium text-text-primary mb-1">Device Alias</div>
                  <input
                    type="text"
                    value={useSettingsStore(s => s.nexDropAlias) || ''}
                    onChange={(e) => useSettingsStore.getState().setNexDropAlias(e.target.value)}
                    placeholder="Auto (Hostname)"
                    className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="py-3 px-1">
                  <div className="text-[13px] font-medium text-text-primary mb-1">Save Directory</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={useSettingsStore(s => s.nexDropSaveDirectory) || ''}
                      onChange={(e) => useSettingsStore.getState().setNexDropSaveDirectory(e.target.value)}
                      placeholder="Auto (Downloads)"
                      className="flex-1 bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />
                    <button
                      className="px-3 bg-bg-tertiary border border-border rounded-lg hover:bg-bg-hover"
                      onClick={async () => {
                        try {
                          const selected = await invoke<string | null>('plugin:dialog|open', {
                            directory: true,
                            multiple: false,
                            title: 'Select NexDrop Save Directory',
                          });
                          if (selected) {
                            useSettingsStore.getState().setNexDropSaveDirectory(selected);
                          }
                        } catch (err) {
                          console.error('Folder picker failed:', err);
                        }
                      }}
                    >
                      <FolderOpen size={16} className="text-text-muted" />
                    </button>
                  </div>
                </div>

                <div className="py-3 px-1">
                  <div className="text-[13px] font-medium text-text-primary mb-1">Port</div>
                  <input
                    type="number"
                    value={useSettingsStore(s => s.nexDropPort)}
                    onChange={(e) => useSettingsStore.getState().setNexDropPort(Number(e.target.value))}
                    placeholder="53317"
                    className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <ToggleRow
                  label="Auto-accept files"
                  description="Automatically receive incoming files without prompt"
                  checked={useSettingsStore(s => s.nexDropAutoAccept)}
                  onChange={(val) => useSettingsStore.getState().setNexDropAutoAccept(val)}
                  icon={<Shield size={16} />}
                />
              </section>

              <div className="h-px bg-border" />

              {/* ─── SYSTEM ─────────────────── */}
              <section>
                <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Shield size={12} /> System Integration
                </h3>

                <ToggleRow
                  label="Windows Context Menu"
                  description="Add 'Open with NexExplorer' to Explorer"
                  checked={shellIntegration}
                  onChange={async (val) => {
                    setShellIntegration(val);
                    try {
                      if (val) {
                        await invoke('register_shell_extension');
                      } else {
                        await invoke('unregister_shell_extension');
                      }
                    } catch (e) {
                      console.error('Shell extension error:', e);
                    }
                  }}
                  icon={<Shield size={16} />}
                />
              </section>

              <div className="h-px bg-border" />

              {/* ─── PERFORMANCE ──────────────── */}
              <section>
                <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Gauge size={12} /> Performance
                </h3>

                <ToggleRow
                  label="Disable thumbnails"
                  description="Save RAM by showing file type icons only"
                  checked={disableThumbnails}
                  onChange={setDisableThumbnails}
                  icon={<EyeOff size={16} />}
                />

                <ToggleRow
                  label="Disable file previews"
                  description="Skip preview pane rendering"
                  checked={disablePreviews}
                  onChange={setDisablePreviews}
                  icon={<Eye size={16} />}
                />

                <div className="py-3 px-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Shield size={16} className="text-text-muted" />
                    <div>
                      <div className="text-[13px] font-medium text-text-primary">Max files before paginating</div>
                      <div className="text-[11px] text-text-muted">Folders with more files will load in pages</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <input
                      type="range"
                      min="200"
                      max="5000"
                      step="100"
                      value={maxFilesBeforePaginate}
                      onChange={(e) => setMaxFilesBeforePaginate(Number(e.target.value))}
                      className="flex-1 accent-accent h-1"
                    />
                    <span className="text-[12px] font-mono text-text-secondary w-12 text-right">{maxFilesBeforePaginate}</span>
                  </div>
                </div>
              </section>

              <div className="h-px bg-border" />

              {/* ─── KEYBOARD SHORTCUTS ──────── */}
              <section>
                <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-3">Keyboard Shortcuts</h3>
                <div className="space-y-1.5 text-[12px]">
                  {[
                    ['Ctrl+C', 'Copy'],
                    ['Ctrl+X', 'Cut'],
                    ['Ctrl+V', 'Paste'],
                    ['Ctrl+A', 'Select all'],
                    ['Ctrl+F', 'Search'],
                    ['Ctrl+H', 'Toggle hidden files'],
                    ['Ctrl+Shift+N', 'New folder'],
                    ['Del', 'Delete'],
                    ['F2', 'Rename'],
                    ['F5', 'Refresh'],
                    ['Alt+←', 'Back'],
                    ['Alt+→', 'Forward'],
                    ['Alt+↑', 'Up one level'],
                  ].map(([key, desc]) => (
                    <div key={key} className="flex justify-between py-1 px-1">
                      <span className="text-text-secondary">{desc}</span>
                      <kbd className="text-[10px] bg-bg-tertiary px-2 py-0.5 rounded border border-border font-mono text-text-muted">{key}</kbd>
                    </div>
                  ))}
                </div>
              </section>

              {/* Bottom spacer */}
              <div className="h-4" />
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-border flex items-center justify-between text-[11px] text-text-muted">
              <span>NexExplorer v1.0.0</span>
              <button
                onClick={() => {
                  localStorage.removeItem('nex-settings');
                  localStorage.removeItem('nex-theme');
                  window.location.reload();
                }}
                className="text-error/70 hover:text-error transition-colors"
              >
                Reset all settings
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SettingsPanel;
