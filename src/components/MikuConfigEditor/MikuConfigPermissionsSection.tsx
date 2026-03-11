'use client';

import type { MikuFilePermissions } from '@/lib/mikuFileParser';

interface MikuConfigPermissionsSectionProps {
  permissions: MikuFilePermissions;
  onChange: (permissions: MikuFilePermissions) => void;
}

export default function MikuConfigPermissionsSection({ permissions, onChange }: MikuConfigPermissionsSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Permissions</h2>

      <div className="space-y-2">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={permissions.allowFileRead}
            onChange={(e) => onChange({ ...permissions, allowFileRead: e.target.checked })}
            className="rounded border-[var(--border-primary)] accent-[var(--accent-primary)]"
          />
          <div>
            <span className="text-sm text-[var(--text-primary)]">Allow File Reading</span>
            <p className="text-xs text-[var(--text-secondary)]">Agent can read files in the working directory</p>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={permissions.allowFileWrite}
            onChange={(e) => onChange({ ...permissions, allowFileWrite: e.target.checked })}
            className="rounded border-[var(--border-primary)] accent-[var(--accent-primary)]"
          />
          <div>
            <span className="text-sm text-[var(--text-primary)]">Allow File Writing</span>
            <p className="text-xs text-[var(--text-secondary)]">Agent can create and modify files (requires permission per-action)</p>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={permissions.allowTerminal}
            onChange={(e) => onChange({ ...permissions, allowTerminal: e.target.checked })}
            className="rounded border-[var(--border-primary)] accent-[var(--accent-primary)]"
          />
          <div>
            <span className="text-sm text-[var(--text-primary)]">Allow Terminal Commands</span>
            <p className="text-xs text-[var(--text-secondary)]">Agent can execute shell commands (requires permission per-action)</p>
          </div>
        </label>
      </div>

      <div className="space-y-2">
        <label className="block text-sm text-[var(--text-secondary)]">Allowed Paths (one per line, empty = all)</label>
        <textarea
          value={(permissions.allowedPaths || []).join('\n')}
          onChange={(e) => {
            const paths = e.target.value.split('\n').filter(p => p.trim());
            onChange({ ...permissions, allowedPaths: paths.length > 0 ? paths : undefined });
          }}
          className="w-full px-3 py-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-xs font-mono focus:outline-none focus:border-[var(--accent-primary)] resize-y"
          rows={2}
          placeholder="./src&#10;./docs"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm text-[var(--text-secondary)]">Denied Paths (one per line)</label>
        <textarea
          value={(permissions.deniedPaths || []).join('\n')}
          onChange={(e) => {
            const paths = e.target.value.split('\n').filter(p => p.trim());
            onChange({ ...permissions, deniedPaths: paths.length > 0 ? paths : undefined });
          }}
          className="w-full px-3 py-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-xs font-mono focus:outline-none focus:border-[var(--accent-primary)] resize-y"
          rows={2}
          placeholder="./secrets&#10;./.env"
        />
      </div>
    </section>
  );
}
