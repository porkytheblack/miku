'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { parseMikuFile, serializeMikuFile, createDefaultMikuFile, MikuFileParseError } from '@/lib/mikuFileParser';
import type { MikuFileConfig, MikuFileProvider, MikuFileTool, MikuFileMode, MikuFilePermissions } from '@/lib/mikuFileParser';
import MikuConfigToolbar from './MikuConfigToolbar';
import MikuConfigProviderSection from './MikuConfigProviderSection';
import MikuConfigToolsSection from './MikuConfigToolsSection';
import MikuConfigModesSection from './MikuConfigModesSection';
import MikuConfigPermissionsSection from './MikuConfigPermissionsSection';

interface MikuConfigEditorProps {
  initialContent?: string;
  onContentChange: (content: string) => void;
}

export default function MikuConfigEditor({ initialContent, onContentChange }: MikuConfigEditorProps) {
  const [config, setConfig] = useState<MikuFileConfig>(() => {
    if (initialContent) {
      try {
        return parseMikuFile(initialContent);
      } catch {
        return createDefaultMikuFile('My Agent');
      }
    }
    return createDefaultMikuFile('My Agent');
  });
  const [parseError, setParseError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual');
  const [jsonContent, setJsonContent] = useState('');
  const isUpdatingRef = useRef(false);

  // Sync config to parent
  const syncConfig = useCallback((newConfig: MikuFileConfig) => {
    setConfig(newConfig);
    if (!isUpdatingRef.current) {
      isUpdatingRef.current = true;
      const serialized = serializeMikuFile(newConfig);
      onContentChange(serialized);
      setJsonContent(serialized);
      isUpdatingRef.current = false;
    }
  }, [onContentChange]);

  // Initialize JSON content
  useEffect(() => {
    setJsonContent(serializeMikuFile(config));
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleNameChange = useCallback((name: string) => {
    syncConfig({ ...config, name });
  }, [config, syncConfig]);

  const handleDescriptionChange = useCallback((description: string) => {
    syncConfig({ ...config, description });
  }, [config, syncConfig]);

  const handleWorkingDirectoryChange = useCallback((workingDirectory: string) => {
    syncConfig({ ...config, workingDirectory: workingDirectory || undefined });
  }, [config, syncConfig]);

  const handleProviderChange = useCallback((provider: MikuFileProvider) => {
    syncConfig({ ...config, provider });
  }, [config, syncConfig]);

  const handleSystemPromptChange = useCallback((systemPrompt: string) => {
    syncConfig({ ...config, systemPrompt: systemPrompt || undefined });
  }, [config, syncConfig]);

  const handleToolsChange = useCallback((tools: MikuFileTool[]) => {
    syncConfig({ ...config, tools });
  }, [config, syncConfig]);

  const handleModesChange = useCallback((modes: MikuFileMode[]) => {
    syncConfig({ ...config, modes });
  }, [config, syncConfig]);

  const handlePermissionsChange = useCallback((permissions: MikuFilePermissions) => {
    syncConfig({ ...config, permissions });
  }, [config, syncConfig]);

  const handleJsonChange = useCallback((json: string) => {
    setJsonContent(json);
    try {
      const parsed = parseMikuFile(json);
      setConfig(parsed);
      setParseError(null);
      isUpdatingRef.current = true;
      onContentChange(json);
      isUpdatingRef.current = false;
    } catch (err) {
      if (err instanceof MikuFileParseError) {
        setParseError(err.message);
      } else {
        setParseError('Invalid JSON');
      }
    }
  }, [onContentChange]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <MikuConfigToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        agentName={config.name}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {viewMode === 'visual' ? (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Agent Name & Description */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Agent Configuration</h2>
              <div className="space-y-2">
                <label className="block text-sm text-[var(--text-secondary)]">Agent Name</label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                  placeholder="My Agent"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm text-[var(--text-secondary)]">Description</label>
                <input
                  type="text"
                  value={config.description || ''}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                  placeholder="What this agent does..."
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm text-[var(--text-secondary)]">Working Directory</label>
                <input
                  type="text"
                  value={config.workingDirectory || ''}
                  onChange={(e) => handleWorkingDirectoryChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-sm font-mono focus:outline-none focus:border-[var(--accent-primary)]"
                  placeholder="./path/to/folder (relative to .miku file)"
                />
              </div>
            </section>

            {/* AI Provider */}
            <MikuConfigProviderSection
              provider={config.provider}
              onChange={handleProviderChange}
            />

            {/* System Prompt */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">System Prompt</h2>
              <textarea
                value={config.systemPrompt || ''}
                onChange={(e) => handleSystemPromptChange(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-sm font-mono focus:outline-none focus:border-[var(--accent-primary)] min-h-[120px] resize-y"
                placeholder="Custom system prompt for the agent (optional)..."
                rows={5}
              />
            </section>

            {/* Modes */}
            <MikuConfigModesSection
              modes={config.modes || []}
              onChange={handleModesChange}
            />

            {/* Permissions */}
            <MikuConfigPermissionsSection
              permissions={config.permissions || { allowFileRead: true, allowFileWrite: true, allowTerminal: false }}
              onChange={handlePermissionsChange}
            />

            {/* Custom Tools */}
            <MikuConfigToolsSection
              tools={config.tools || []}
              onChange={handleToolsChange}
            />

            {/* ACP Info */}
            <section className="space-y-3 pb-8">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">ACP Integration</h2>
              <div className="p-4 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-sm text-[var(--text-secondary)] space-y-2">
                <p>This .miku file configures an ACP-compatible agent that can be used with:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Zed editor (acp: connect agent)</li>
                  <li>Neovim (via ACP plugin)</li>
                  <li>Any ACP-compatible client</li>
                </ul>
                <p className="mt-3">Run the agent with:</p>
                <code className="block p-2 rounded bg-[var(--bg-primary)] font-mono text-xs">
                  npx tsx src/lib/acp/cli.ts {config.workingDirectory || '.'}
                </code>
              </div>
            </section>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {parseError && (
              <div className="mb-3 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {parseError}
              </div>
            )}
            <textarea
              value={jsonContent}
              onChange={(e) => handleJsonChange(e.target.value)}
              className="w-full h-[calc(100vh-200px)] px-4 py-3 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-sm font-mono focus:outline-none focus:border-[var(--accent-primary)] resize-none"
              spellCheck={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
