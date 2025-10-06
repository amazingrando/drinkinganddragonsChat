import { UserButton } from "@clerk/nextjs";
import { ModeToggle } from "@/components/mode-toggle";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <p className="text-4xl text-indigo-500">Protected routes</p>
      <UserButton />
      <ModeToggle />
    </div>
  );
}
