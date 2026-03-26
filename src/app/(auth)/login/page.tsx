"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { buyerLoginAction } from "@/app/actions/auth";

const schema = z.object({
  accountNumber: z
    .string()
    .min(1, "Account number is required")
    .max(20, "Account number too long"),
});

type FormValues = z.infer<typeof schema>;

export default function BuyerLoginPage() {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  function onSubmit(data: FormValues) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("accountNumber", data.accountNumber);

      const result = await buyerLoginAction(formData);

      // If redirect didn't happen, an error was returned
      if (result?.error) {
        setError("accountNumber", { message: result.error });
      }
    });
  }

  return (
    <AuthCard
      title="Ordering Portal"
      description="Enter your account number to access your portal."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="accountNumber">Account Number</Label>
          <Input
            id="accountNumber"
            placeholder="e.g. RAS-00123"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            disabled={isPending}
            {...register("accountNumber")}
          />
          {errors.accountNumber && (
            <p className="text-sm font-medium text-destructive">
              {errors.accountNumber.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Signing in…
            </>
          ) : (
            "Sign In"
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Admin?{" "}
          <a
            href="/admin/login"
            className="underline underline-offset-4 hover:text-primary"
          >
            Sign in here
          </a>
        </p>
      </form>
    </AuthCard>
  );
}
