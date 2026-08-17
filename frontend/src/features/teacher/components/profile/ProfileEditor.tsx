"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { User as UserIcon, Save, Loader2, Info } from "lucide-react";
import { useTeacherProfile, useUpdateTeacherProfile } from "@/hooks/queries/useTeacherQueries";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useNotificationsStore } from "@/stores/notifications.store";

const profileSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters."),
  bio: z.string().max(1000, "Bio must not exceed 1000 characters.").optional(),
  country: z.string().optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const inputClass = "h-12 rounded-xl border-border/50 bg-card/50 focus-visible:ring-1 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50 hover:bg-card/80 transition-all text-foreground font-semibold";

export function ProfileEditor() {
  const { addToast } = useNotificationsStore();
  const { data: user, isLoading } = useTeacherProfile();
  const updateMutation = useUpdateTeacherProfile();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: "",
      bio: "",
      country: "",
      language: "",
      timezone: "",
    },
  });

  React.useEffect(() => {
    if (user) {
      form.reset({
        fullName: user.fullName || "",
        bio: (user as any).bio || "",
        country: (user as any).country || "",
        language: (user as any).language || "",
        timezone: (user as any).timezone || "",
      });
    }
  }, [user, form]);

  async function onSubmit(data: ProfileFormValues) {
    updateMutation.mutate(data as any, {
      onSuccess: () => {
        addToast({
          title: "Profile Updated",
          description: "Your professional profile has been saved successfully.",
          variant: "success",
        });
      },
      onError: () => {
        addToast({
          title: "Update Failed",
          description: "There was an error updating your profile.",
          variant: "error",
        });
      }
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[400px] w-full rounded-2xl bg-border/30" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 relative animate-fade-up">

        {/* Personal Information */}
        <div className="card-glass p-6 sm:p-8">
          <div className="mb-8">
            <h3 className="text-xl font-extrabold tracking-tight flex items-center gap-3 text-foreground">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                <UserIcon className="h-5 w-5 text-violet-400" />
              </div>
              Profile Information
            </h3>
            <p className="text-sm font-semibold text-muted-foreground mt-2">Update your basic identity and public bio.</p>
          </div>

          <div className="space-y-6">
            <FormField control={form.control} name="fullName" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Full Name</FormLabel>
                <FormControl>
                  <Input {...field} className={inputClass} />
                </FormControl>
                <FormMessage className="text-destructive font-semibold" />
              </FormItem>
            )} />

            <FormField control={form.control} name="bio" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold tracking-widest uppercase text-muted-foreground flex justify-between items-end">
                  About Section (Bio)
                  <span className="text-[10px] font-normal opacity-50 flex items-center gap-1"><Info className="h-3 w-3" /> Max 1000 chars</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={6}
                    className={`resize-none rounded-xl border-border/50 bg-card/50 focus-visible:ring-1 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50 hover:bg-card/80 transition-all text-foreground font-medium p-4 leading-relaxed`}
                  />
                </FormControl>
                <FormMessage className="text-destructive font-semibold" />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
              <FormField control={form.control} name="country" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Country</FormLabel>
                  <FormControl>
                    <Input {...field} className={inputClass} />
                  </FormControl>
                  <FormMessage className="text-destructive font-semibold" />
                </FormItem>
              )} />
              <FormField control={form.control} name="language" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Language</FormLabel>
                  <FormControl>
                    <Input {...field} className={inputClass} />
                  </FormControl>
                  <FormMessage className="text-destructive font-semibold" />
                </FormItem>
              )} />
              <FormField control={form.control} name="timezone" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Timezone</FormLabel>
                  <FormControl>
                    <Input {...field} className={inputClass} />
                  </FormControl>
                  <FormMessage className="text-destructive font-semibold" />
                </FormItem>
              )} />
            </div>
          </div>
        </div>

        <div className="flex justify-end sticky bottom-8 z-40 p-4 bg-card/95 backdrop-blur-3xl border border-border/50 rounded-2xl shadow-2xl">
          <Button
            type="submit"
            disabled={updateMutation.isPending}
            className="btn-primary w-full sm:w-auto h-12 px-8 rounded-xl press-scale"
          >
            {updateMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
            Save Profile Changes
          </Button>
        </div>

      </form>
    </Form>
  );
}
