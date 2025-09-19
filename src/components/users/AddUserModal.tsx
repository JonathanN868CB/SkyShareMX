import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus } from "lucide-react";

import { inviteUser } from "@/lib/api/users";
import type { Role } from "@/lib/types/users";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

const addUserSchema = z.object({
  fullName: z.string().min(2, "Enter a full name"),
  email: z.string().email("Enter a valid email address"),
  role: z.enum(["viewer", "technician", "manager", "admin"], { required_error: "Choose a role" }),
});

type AddUserFormValues = z.infer<typeof addUserSchema>;

interface AddUserModalProps {
  onSuccess: () => void;
  disabled?: boolean;
  mockMode?: boolean;
  hasSuperAdmin: boolean;
}

const roleLabels: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  technician: "Technician",
  viewer: "Viewer",
};

export function AddUserModal({ onSuccess, disabled = false, mockMode = false, hasSuperAdmin }: AddUserModalProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      fullName: "",
      email: "",
      role: "viewer",
    },
  });

  const closeModal = () => setOpen(false);

  const handleSubmit = async (values: AddUserFormValues) => {
    if (disabled) {
      return;
    }

    if (mockMode) {
      toast({
        title: "Mock data mode",
        description: "Invites are disabled because the app is using mock data.",
      });
      return;
    }

    try {
      setSubmitting(true);
      await inviteUser({ email: values.email.trim(), fullName: values.fullName.trim(), role: values.role });
      toast({
        title: "Invitation sent",
        description: `${values.fullName} will receive an email invitation shortly.`,
      });
      form.reset({ fullName: "", email: "", role: "viewer" });
      closeModal();
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to invite user";
      toast({
        title: "Invite failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => !disabled && setOpen(next)}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className="flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite a new user</DialogTitle>
          <DialogDescription>Send an invitation email to add someone to the SkyShare team.</DialogDescription>
        </DialogHeader>
        {hasSuperAdmin && (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Super admin access is already assigned. Additional invites will be created with standard roles only.
          </p>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="mt-4 space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane Cooper" {...field} disabled={submitting} />
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
                    <Input type="email" placeholder="person@skyshare.com" {...field} disabled={submitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={submitting}>
                    <FormControl>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.keys(roleLabels) as Role[]).map(roleValue => (
                        <SelectItem key={roleValue} value={roleValue}>
                          {roleLabels[roleValue]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={closeModal} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="min-w-[120px]">
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </span>
                ) : (
                  "Send invite"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
