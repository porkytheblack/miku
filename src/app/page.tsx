'use client';

import { useState } from 'react';
import BlockEditor from "@/components/BlockEditor";
import FloatingBar from "@/components/FloatingBar";
import WorkspaceSelector from "@/components/WorkspaceSelector";
import FileBrowser from "@/components/FileBrowser";

export default function Home() {
  const [isFileBrowserOpen, setIsFileBrowserOpen] = useState(false);

  return (
    <main className="relative min-h-screen">
      <WorkspaceSelector />
      <FileBrowser isOpen={isFileBrowserOpen} onClose={() => setIsFileBrowserOpen(false)} />
      <BlockEditor />
      <FloatingBar onToggleFileBrowser={() => setIsFileBrowserOpen(prev => !prev)} />
    </main>
  );
}
