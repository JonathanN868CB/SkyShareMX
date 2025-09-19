import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailPlus, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const ACCESS_REQUEST_FUNCTION_URL =
  import.meta.env.VITE_ACCESS_REQUEST_FUNCTION_URL ??
  (typeof process !== "undefined" ? process.env?.VITE_ACCESS_REQUEST_FUNCTION_URL : undefined) ??
  "/.netlify/functions/send-access-request";

const requestAccessSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  company: z
    .string()
    .trim()
    .optional(),
  reason: z
    .string()
    .trim()
    .min(10, "Share a brief reason so we can route your request"),
});

type RequestAccessFormData = z.infer<typeof requestAccessSchema>;

type SendAccessRequestResponse = {
  success?: boolean;
  error?: string;
};

const DOMAIN_NUDGE = "Have a SkyShare crew email? Sign in with Google using your @skyshare.com address instead.";

export default function RequestAccess() {
  const form = useForm<RequestAccessFormData>({
    resolver: zodResolver(requestAccessSchema),
    defaultValues: {
      fullName: "",
      email: "",
      company: "",
      reason: "",
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailValue = form.watch("email");
  const isSkyshareEmail = useMemo(() => {
    if (!emailValue) return false;
    return emailValue.trim().toLowerCase().endsWith("@skyshare.com");
  }, [emailValue]);

  const onSubmit = async (values: RequestAccessFormData) => {
    setIsSubmitting(true);

    const payload = {
      full_name: values.fullName.trim(),
      email: values.email.trim(),
      company: values.company?.trim() ? values.company.trim() : null,
      reason: values.reason.trim(),
    };

    try {
      const { error: insertError } = await supabase.from("access_requests").insert(payload);
      if (insertError) {
        throw new Error(insertError.message);
      }

      let notificationError: string | null = null;

      try {
        const response = await fetch(ACCESS_REQUEST_FUNCTION_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName: payload.full_name,
            email: payload.email,
            company: payload.company,
            reason: payload.reason,
          }),
        });

        let parsed: SendAccessRequestResponse | null = null;
        try {
          parsed = await response.json();
        } catch (parseError) {
          console.warn("Request access notification response was not JSON", parseError);
        }

        if (!response.ok || parsed?.success === false) {
          notificationError = parsed?.error || `Notification failed (status ${response.status})`;
        }
      } catch (error) {
        notificationError = error instanceof Error ? error.message : "Failed to notify SkyShareMX";
        console.error("Failed to send access request notification", error);
      }

      form.reset();

      if (notificationError) {
        toast({
          title: "Request received",
          description:
            "We saved your request, but the notification email did not send automatically. We'll review it shortly.",
        });
      } else {
        toast({
          title: "Request submitted",
          description: "Thanks! Our maintenance leadership will review and follow up via email.",
        });
      }
    } catch (error) {
      console.error("Failed to submit access request", error);
      toast({
        title: "Unable to submit request",
        description:
          error instanceof Error ? error.message : "Something went wrong while saving your request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-muted/50 py-12 sm:py-16">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6">
        <div className="space-y-3 text-center">
          <div className="flex justify-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MailPlus className="h-6 w-6" />
            </div>
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Request access to the SkyShareMX maintenance portal
          </h1>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground">
            Fill out the form below and our maintenance leadership will review your request. We only grant access to
            SkyShare partners and vetted vendors to protect aircraft data.
          </p>
        </div>

        <Card className="border-border/60 bg-background/95 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle>Tell us about yourself</CardTitle>
            <CardDescription>
              Provide enough detail so we can verify your relationship to SkyShare and assign the right level of access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input placeholder="Jane Doe" autoComplete="name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="you@company.com" type="email" autoComplete="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isSkyshareEmail && (
                  <Alert className="border-primary/40 bg-primary/10 text-primary">
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>Already part of SkyShare?</AlertTitle>
                    <AlertDescription>{DOMAIN_NUDGE}</AlertDescription>
                  </Alert>
                )}

                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company or organization</FormLabel>
                      <FormControl>
                        <Input placeholder="SkyShareMX" autoComplete="organization" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>How will you use the portal?</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe your role, the aircraft or programs you support, and why you need access."
                          className="min-h-[140px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button type="submit" disabled={isSubmitting} className="sm:w-auto">
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                    Submit request
                  </Button>
                  <Button type="button" variant="ghost" asChild className="text-sm">
                    <Link to="/">Back to home</Link>
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
