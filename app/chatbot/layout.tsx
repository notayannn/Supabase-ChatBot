import { AuthButton } from "@/components/auth-button";
import Link from "next/link";
import { Suspense } from "react";

export default function ChatbotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="h-screen w-full flex flex-col overflow-hidden bg-white dark:bg-zinc-950">
      <nav className="w-full flex items-center justify-between border-b h-14 shrink-0 px-5">
        <Link href="/" className="text-sm font-semibold hover:underline">
          ← Next.js Supabase Starter
        </Link>
        <Suspense>
          <AuthButton />
        </Suspense>
      </nav>
      <div className="flex-1 min-h-0 w-full flex">{children}</div>
    </main>
  );
}