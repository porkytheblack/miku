'use client';

import { useState } from 'react';
import BlockEditor from "@/components/BlockEditor";
import FloatingBar from "@/components/FloatingBar";
import WorkspaceSelector from "@/components/WorkspaceSelector";
import FileBrowser from "@/components/FileBrowser";
import TopBar from "@/components/TopBar";
import SoundNotifier from "@/components/SoundNotifier";

export default function Home() {
  const [isFileBrowserOpen, setIsFileBrowserOpen] = useState(false);

  return (
    <main className="relative min-h-screen flex flex-col">
      <SoundNotifier />
      <WorkspaceSelector />
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <FileBrowser isOpen={isFileBrowserOpen} onClose={() => setIsFileBrowserOpen(false)} />
        <div className="flex-1 overflow-auto">
          <BlockEditor />
        </div>
      </div>
      <FloatingBar onToggleFileBrowser={() => setIsFileBrowserOpen(prev => !prev)} />
    </main>
  );
}
