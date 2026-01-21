import BlockEditor from "@/components/BlockEditor";
import FloatingBar from "@/components/FloatingBar";

// Force dynamic rendering to avoid static build issues with Clerk
export const dynamic = 'force-dynamic';

export default function EditorPage() {
  return (
    <main className="relative min-h-screen">
      <BlockEditor />
      <FloatingBar />
    </main>
  );
}
