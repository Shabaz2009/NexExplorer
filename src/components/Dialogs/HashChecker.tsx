import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Shield, Copy, Check, X, Loader2 } from 'lucide-react';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

interface HashCheckerProps {
  path: string;
  onClose: () => void;
}

const HashChecker: React.FC<HashCheckerProps> = ({ path, onClose }) => {
  const [hashes, setHashes] = useState<{ md5: string, sha256: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyHash, setVerifyHash] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const calc = async () => {
      try {
        const result = await invoke<{ md5: string, sha256: string }>('calculate_file_hashes', { path });
        setHashes(result);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    calc();
  }, [path]);

  const copyToClipboard = async (text: string, label: string) => {
    await writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const getStatus = () => {
    if (!verifyHash || !hashes) return null;
    const v = verifyHash.trim().toLowerCase();
    if (v === hashes.md5.toLowerCase()) return { match: true, type: 'MD5' };
    if (v === hashes.sha256.toLowerCase()) return { match: true, type: 'SHA256' };
    return { match: false };
  };

  const status = getStatus();

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-bg-secondary w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-border bg-bg-tertiary flex items-center justify-between">
          <div className="flex items-center gap-2 text-accent">
            <Shield size={20} />
            <h3 className="font-bold text-sm">File Hash Checker</h3>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">File Path</label>
            <div className="text-xs truncate bg-bg-primary/50 p-2 rounded border border-border/50 text-text-secondary">
              {path}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">MD5</label>
                {hashes && (
                  <button 
                    onClick={() => copyToClipboard(hashes.md5, 'md5')}
                    className="text-accent hover:underline text-[10px] flex items-center gap-1"
                  >
                    {copied === 'md5' ? <Check size={10} /> : <Copy size={10} />}
                    {copied === 'md5' ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>
              <div className="bg-bg-primary/30 p-2 rounded border border-border font-mono text-[10px] break-all min-h-[32px] flex items-center">
                {loading ? <Loader2 size={12} className="animate-spin text-accent" /> : hashes?.md5}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">SHA256</label>
                {hashes && (
                  <button 
                    onClick={() => copyToClipboard(hashes.sha256, 'sha256')}
                    className="text-accent hover:underline text-[10px] flex items-center gap-1"
                  >
                    {copied === 'sha256' ? <Check size={10} /> : <Copy size={10} />}
                    {copied === 'sha256' ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>
              <div className="bg-bg-primary/30 p-2 rounded border border-border font-mono text-[10px] break-all min-h-[32px] flex items-center">
                {loading ? <Loader2 size={12} className="animate-spin text-accent" /> : hashes?.sha256}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border space-y-3">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Verify Hash</label>
            <div className="relative">
              <input 
                type="text" 
                value={verifyHash}
                onChange={e => setVerifyHash(e.target.value)}
                placeholder="Paste hash here to verify..."
                className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2 text-xs focus:border-accent outline-none transition-colors"
              />
              {status && (
                <div className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] font-bold ${status.match ? 'text-success' : 'text-error'}`}>
                  {status.match ? <Check size={12} /> : <X size={12} />}
                  {status.match ? `${status.type} Match` : 'No Match'}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-bg-tertiary border-t border-border flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-bg-secondary hover:bg-bg-hover border border-border rounded-lg text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default HashChecker;
