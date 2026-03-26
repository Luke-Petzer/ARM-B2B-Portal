import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AuthCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <div className="w-full max-w-sm">
      <Card className="w-full shadow-2xl border-0 overflow-hidden">
        {/* Logo sits on the same white background as logo.png — no visible border */}
        <div className="flex justify-center items-center px-10 pt-10 pb-6 bg-white">
          <div className="relative w-full h-[100px]">
            <Image
              src="/logo.png"
              alt="AR Steel Manufacturing"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>
        <CardHeader className="space-y-1 pt-2">
          <CardTitle className="text-2xl font-bold tracking-tight">
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
