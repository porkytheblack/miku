import Editor from "@/components/Editor";
import FloatingBar from "@/components/FloatingBar";

export default function Home() {
  return (
    <main className="relative min-h-screen">
      <Editor />
      <FloatingBar />
    </main>
  );
}
