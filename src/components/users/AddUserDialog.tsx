import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const addUserSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(['Read-Only', 'Technician', 'Manager', 'Admin'], {
    required_error: "Please select a role",
  }),
});

type AddUserFormData = z.infer<typeof addUserSchema>;

interface AddUserDialogProps {
  onUserAdded: () => void;
}

export function AddUserDialog({ onUserAdded }: AddUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<AddUserFormData>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      role: "Read-Only",
    },
  });

  const onSubmit = async (data: AddUserFormData) => {
    setIsLoading(true);
    try {
      // First, create the user invite in our system
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: data.email,
        email_confirm: false,
        user_metadata: {
          first_name: data.firstName,
          last_name: data.lastName,
        }
      });

      if (authError) {
        throw authError;
      }

      if (!authUser.user) {
        throw new Error("Failed to create user");
      }

      // Update the profile with the selected role
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          role: data.role,
          first_name: data.firstName,
          last_name: data.lastName,
          status: 'Pending'
        })
        .eq('user_id', authUser.user.id);

      if (profileError) {
        console.error('Profile update error:', profileError);
      }

      // Set default permissions based on role
      const permissions = [];
      if (data.role === 'Read-Only') {
        permissions.push('Overview');
      } else if (data.role === 'Technician') {
        permissions.push('Overview', 'Operations');
      } else if (data.role === 'Manager') {
        permissions.push('Overview', 'Operations', 'Administration');
      } else if (data.role === 'Admin') {
        permissions.push('Overview', 'Operations', 'Administration', 'Development');
      }

      // Add permissions
      if (permissions.length > 0) {
        const permissionInserts = permissions.map(section => ({
          user_id: authUser.user.id,
          section: section
        }));

        const { error: permissionError } = await supabase
          .from('user_permissions')
          .insert(permissionInserts);

        if (permissionError) {
          console.error('Permission error:', permissionError);
        }
      }

      // Send invitation email
      try {
        const { error: emailError } = await supabase.functions.invoke('send-user-invitation', {
          body: {
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            role: data.role,
          }
        });

        if (emailError) {
          console.error('Email error:', emailError);
          toast({
            title: "User created but email failed",
            description: "The user was added but the invitation email could not be sent.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "User invited successfully",
            description: `Invitation sent to ${data.email}`,
          });
        }
      } catch (emailError) {
        console.error('Email error:', emailError);
        toast({
          title: "User created but email failed",
          description: "The user was added but the invitation email could not be sent.",
          variant: "destructive",
        });
      }

      form.reset();
      setOpen(false);
      onUserAdded();

    } catch (error) {
      console.error('Error adding user:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add user",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Add User</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite New User</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="user@company.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Read-Only">Read-Only</SelectItem>
                      <SelectItem value="Technician">Technician</SelectItem>
                      <SelectItem value="Manager">Manager</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Sending Invitation..." : "Send Invitation"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}