"use client";

import { useTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin } from "lucide-react";
import { saveAddressAction } from "@/app/actions/addresses";

const schema = z.object({
  line1: z.string().min(1, "Street address is required"),
  line2: z.string().optional(),
  suburb: z.string().optional(),
  city: z.string().min(1, "City is required"),
  province: z.string().optional(),
  postal_code: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface AddressGateFormProps {
  onSaved: () => void;
}

export default function AddressGateForm({ onSaved }: AddressGateFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function onSubmit(data: FormValues) {
    setServerError(null);
    startTransition(async () => {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v) fd.set(k, v); });
      const result = await saveAddressAction(fd);
      if ("error" in result) {
        setServerError(result.error);
      } else {
        onSaved();
      }
    });
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-amber-50 border-amber-200">
      <div className="flex items-center gap-2 text-amber-800">
        <MapPin className="h-4 w-4 shrink-0" />
        <p className="text-sm font-medium">
          Please add a delivery address before placing your first order.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <Label htmlFor="line1" className="text-xs">Street Address *</Label>
          <Input id="line1" placeholder="123 Main Street" {...register("line1")} />
          {errors.line1 && <p className="text-xs text-red-500 mt-1">{errors.line1.message}</p>}
        </div>
        <div>
          <Label htmlFor="line2" className="text-xs">Unit / Building</Label>
          <Input id="line2" placeholder="Unit 4B (optional)" {...register("line2")} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="suburb" className="text-xs">Suburb</Label>
            <Input id="suburb" placeholder="Sandton" {...register("suburb")} />
          </div>
          <div>
            <Label htmlFor="city" className="text-xs">City *</Label>
            <Input id="city" placeholder="Johannesburg" {...register("city")} />
            {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city.message}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="province" className="text-xs">Province</Label>
            <Input id="province" placeholder="Gauteng" {...register("province")} />
          </div>
          <div>
            <Label htmlFor="postal_code" className="text-xs">Postal Code</Label>
            <Input id="postal_code" placeholder="2196" {...register("postal_code")} />
          </div>
        </div>

        {serverError && <p className="text-sm text-red-500">{serverError}</p>}

        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
          Save Address & Continue
        </Button>
      </form>
    </div>
  );
}
