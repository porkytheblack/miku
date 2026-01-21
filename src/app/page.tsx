import BlockEditor from "@/components/BlockEditor";
import FloatingBar from "@/components/FloatingBar";

export default function Home() {
  return (
    <main className="relative min-h-screen">
      <BlockEditor />
      <FloatingBar />
    </main>
  );
}
