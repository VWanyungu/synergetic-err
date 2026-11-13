import { ProtectedRoute } from "@/components/auth/protected-route";
import { Navbar } from "@/components/layout/navbar";
import { PeriodProvider } from "@/contexts/period-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <PeriodProvider>
        <Navbar />
        <main className="mx-auto w-full max-w-[1200px] px-6 pb-16 pt-12">{children}</main>
      </PeriodProvider>
    </ProtectedRoute>
  );
}
