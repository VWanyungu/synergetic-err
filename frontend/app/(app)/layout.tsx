import { ProtectedRoute } from "@/components/auth/protected-route";
import { DivisionGate } from "@/components/layout/division-gate";
import { Navbar } from "@/components/layout/navbar";
import { PeriodProvider } from "@/contexts/period-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <PeriodProvider>
        <Navbar />
        <main className="mx-auto w-full max-w-[1200px] px-4 pb-12 pt-8 sm:px-6 sm:pt-12 lg:pb-16"><DivisionGate>{children}</DivisionGate></main>
      </PeriodProvider>
    </ProtectedRoute>
  );
}
