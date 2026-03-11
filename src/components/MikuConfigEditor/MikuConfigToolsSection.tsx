'use client';

import { useCallback } from 'react';
import type { MikuFileTool } from '@/lib/mikuFileParser';

interface MikuConfigToolsSectionProps {
  tools: MikuFileTool[];
  onChange: (tools: MikuFileTool[]) => void;
}

export default function MikuConfigToolsSection({ tools, onChange }: MikuConfigToolsSectionProps) {
  const addTool = useCallback(() => {
    onChange([...tools, {
      name: `custom_tool_${tools.length + 1}`,
      description: '',
      parameters: {},
    }]);
  }, [tools, onChange]);

  const removeTool = useCallback((index: number) => {
    onChange(tools.filter((_, i) => i !== index));
  }, [tools, onChange]);

  const updateTool = useCallback((index: number, updates: Partial<MikuFileTool>) => {
    const updated = [...tools];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  }, [tools, onChange]);

  const addParameter = useCallback((toolIndex: number) => {
    const tool = tools[toolIndex];
    const paramName = `param_${Object.keys(tool.parameters).length + 1}`;
    updateTool(toolIndex, {
      parameters: {
        ...tool.parameters,
        [paramName]: { type: 'string', description: '' },
      },
    });
  }, [tools, updateTool]);

  const removeParameter = useCallback((toolIndex: number, paramName: string) => {
    const tool = tools[toolIndex];
    const newParams = { ...tool.parameters };
    delete newParams[paramName];
    updateTool(toolIndex, { parameters: newParams });
  }, [tools, updateTool]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Custom Tools</h2>
        <button
          onClick={addTool}
          className="px-3 py-1 text-xs rounded-md bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 transition-colors"
        >
          + Add Tool
        </button>
      </div>

      <p className="text-xs text-[var(--text-secondary)]">
        Custom tools extend the agent&apos;s capabilities. The agent calls these tools during conversations,
        and they can optionally run handler scripts.
      </p>

      {tools.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)] italic">
          No custom tools. The agent uses built-in tools (file read/write, search) based on permissions.
        </p>
      ) : (
        <div className="space-y-3">
          {tools.map((tool, toolIndex) => (
            <div
              key={toolIndex}
              className="p-3 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] space-y-2"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tool.name}
                  onChange={(e) => updateTool(toolIndex, { name: e.target.value })}
                  className="flex-1 px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-sm font-mono focus:outline-none"
                  placeholder="tool_name"
                />
                <button
                  onClick={() => removeTool(toolIndex)}
                  className="p-1 text-[var(--text-secondary)] hover:text-red-400 transition-colors text-xs"
                  title="Remove tool"
                >
                  x
                </button>
              </div>

              <input
                type="text"
                value={tool.description}
                onChange={(e) => updateTool(toolIndex, { description: e.target.value })}
                className="w-full px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-xs focus:outline-none"
                placeholder="What does this tool do?"
              />

              <input
                type="text"
                value={tool.handler || ''}
                onChange={(e) => updateTool(toolIndex, { handler: e.target.value || undefined })}
                className="w-full px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-xs font-mono focus:outline-none"
                placeholder="Handler script path (optional, e.g., ./tools/my-tool.js)"
              />

              {/* Parameters */}
              <div className="space-y-1 ml-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-secondary)]">Parameters</span>
                  <button
                    onClick={() => addParameter(toolIndex)}
                    className="text-xs text-[var(--accent-primary)] hover:underline"
                  >
                    + add
                  </button>
                </div>
                {Object.entries(tool.parameters).map(([paramName, param]) => (
                  <div key={paramName} className="flex items-center gap-1">
                    <input
                      type="text"
                      value={paramName}
                      readOnly
                      className="w-24 px-1 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-xs font-mono"
                    />
                    <select
                      value={param.type}
                      onChange={(e) => {
                        const newParams = { ...tool.parameters };
                        newParams[paramName] = { ...param, type: e.target.value };
                        updateTool(toolIndex, { parameters: newParams });
                      }}
                      className="px-1 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-xs"
                    >
                      <option value="string">string</option>
                      <option value="number">number</option>
                      <option value="boolean">boolean</option>
                    </select>
                    <input
                      type="text"
                      value={param.description}
                      onChange={(e) => {
                        const newParams = { ...tool.parameters };
                        newParams[paramName] = { ...param, description: e.target.value };
                        updateTool(toolIndex, { parameters: newParams });
                      }}
                      className="flex-1 px-1 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-xs"
                      placeholder="Description..."
                    />
                    <button
                      onClick={() => removeParameter(toolIndex, paramName)}
                      className="text-[var(--text-secondary)] hover:text-red-400 text-xs"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
