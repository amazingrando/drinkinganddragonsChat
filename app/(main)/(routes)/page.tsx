import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <p className="text-4xl text-indigo-500">Protected route</p>
      <Button>Click me</Button>
    </div>
  );
}
