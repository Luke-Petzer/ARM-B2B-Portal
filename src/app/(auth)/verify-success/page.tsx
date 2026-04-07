import Link from "next/link";
import Image from "next/image";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

export default function VerifySuccessPage() {
  return (
    <AuthCard title="" description="">
      <div className="flex flex-col items-center gap-5 py-2 text-center">
        <Image
          src="/logo.png"
          alt="AR Steel Manufacturing"
          width={100}
          height={40}
          className="object-contain mix-blend-screen mb-2"
        />
        <ShieldCheck className="h-12 w-12 text-green-500" />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Verification Complete</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Your account is secured. Log in to access the portal.
          </p>
        </div>
        <Button asChild className="w-full mt-2">
          <Link href="/login">Go to Login</Link>
        </Button>
      </div>
    </AuthCard>
  );
}
