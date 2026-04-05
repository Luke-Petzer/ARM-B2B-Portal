"use client";

import { useTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { signUpAction } from "@/app/actions/auth";

const schema = z.object({
  contact_name: z.string().min(1, "Contact name is required"),
  business_name: z.string().optional(),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  terms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Terms and Conditions." }),
  }),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function onSubmit(data: FormValues) {
    setServerError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("contact_name", data.contact_name);
      formData.append("business_name", data.business_name ?? "");
      formData.append("email", data.email);
      formData.append("password", data.password);
      const result = await signUpAction(formData);
      if (result?.error) setServerError(result.error);
    });
  }

  return (
    <AuthCard
      title="Create Account"
      description="Register to access the ordering portal."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="contact_name">Contact Name</Label>
          <Input
            id="contact_name"
            placeholder="Your full name"
            autoComplete="name"
            {...register("contact_name")}
          />
          {errors.contact_name && (
            <p className="text-sm text-red-500">{errors.contact_name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="business_name">
            Business Name{" "}
            <span className="text-muted-foreground font-normal text-xs">
              — optional
            </span>
          </Label>
          <Input
            id="business_name"
            placeholder="Leave blank if individual"
            autoComplete="organization"
            {...register("business_name")}
          />
        </div>

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

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Minimum 8 characters"
            autoComplete="new-password"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-sm text-red-500">{errors.password.message}</p>
          )}
        </div>

        <div className="flex items-start gap-3 pt-1">
          <Checkbox
            id="terms"
            onCheckedChange={(checked) =>
              setValue("terms", checked === true ? true : (undefined as unknown as true), {
                shouldValidate: true,
              })
            }
          />
          <Label htmlFor="terms" className="text-sm font-normal leading-snug cursor-pointer">
            I accept the{" "}
            <Link
              href="/terms"
              target="_blank"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Terms and Conditions
            </Link>{" "}
            and Privacy Policy.
          </Label>
        </div>
        {errors.terms && (
          <p className="text-sm text-red-500">{errors.terms.message}</p>
        )}

        {serverError && (
          <p className="text-sm text-red-500 text-center">{serverError}</p>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Create Account
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
