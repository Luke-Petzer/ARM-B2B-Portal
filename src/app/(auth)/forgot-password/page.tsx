"use client";

import { useTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";
import { forgotPasswordAction } from "@/app/actions/auth";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function onSubmit(data: FormValues) {
    setServerError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("email", data.email);
      const result = await forgotPasswordAction(formData);
      if (result?.error) {
        setServerError(result.error);
      } else {
        setSent(true);
      }
    });
  }

  if (sent) {
    return (
      <AuthCard title="Check Your Email" description="">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
          <p className="text-sm text-muted-foreground">
            If an account exists for that email, a password reset link has been
            sent. Check your inbox.
          </p>
          <Link
            href="/login"
            className="text-sm font-medium underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot Password"
      description="Enter your email and we'll send you a reset link."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>

        {serverError && (
          <p className="text-sm text-red-500 text-center">{serverError}</p>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Send Reset Link
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
