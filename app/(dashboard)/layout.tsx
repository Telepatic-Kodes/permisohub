import { Sidebar } from "@/components/dashboard/sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="ml-64 flex-1 overflow-auto bg-[#F9F7F3]">
        {children}
      </main>
    </div>
  );
}
