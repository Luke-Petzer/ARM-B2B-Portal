export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[100dvh] overflow-y-auto items-start justify-center pt-[10dvh] pb-8 bg-gradient-to-br from-[#1a2f50] via-[#1e3a6e] to-[#0f1e3a] px-4">
      {children}
    </div>
  );
}
