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
    <div className="flex flex-col items-center gap-8 w-full max-w-sm">
      {/* Fixed-size container reserves space before image loads, preventing layout shift */}
      <div className="relative w-[280px] h-[80px] flex-shrink-0">
        <Image
          src="/logo.png"
          alt="AR Steel Manufacturing"
          fill
          className="object-contain"
          priority
        />
      </div>
      <Card className="w-full shadow-2xl border-0">
        <CardHeader className="space-y-1">
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
