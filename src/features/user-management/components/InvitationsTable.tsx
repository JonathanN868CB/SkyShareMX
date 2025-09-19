import { RefreshCw, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { useReadOnly } from "@/hooks/useUserPermissions";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";

import { useUserInvitations } from "../hooks/useUserInvitations";

interface InvitationsTableProps {
  refreshKey?: number;
}

export function InvitationsTable({ refreshKey }: InvitationsTableProps) {
  const { invitations, loading, fetchInvitations, removeInvitation } = useUserInvitations(refreshKey);
  const isReadOnly = useReadOnly();
  const readOnlyMessage = "Your account is read-only. Ask an admin to upgrade your access.";

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Sent':
        return 'default';
      case 'Pending':
        return 'secondary';
      case 'Failed':
        return 'destructive';
      case 'Accepted':
        return 'default';
      case 'Expired':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading invitations...</div>;
  }

  if (invitations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No pending invitations found.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Pending Invitations</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchInvitations}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invitee</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sent</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((invitation) => (
            <TableRow key={invitation.id}>
              <TableCell>
                <div>
                  <div className="font-medium">
                    {invitation.first_name && invitation.last_name
                      ? `${invitation.first_name} ${invitation.last_name}`
                      : invitation.email}
                  </div>
                  {invitation.first_name && invitation.last_name && (
                    <div className="text-sm text-muted-foreground">
                      {invitation.email}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{invitation.role}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={getStatusBadgeVariant(invitation.status)}>
                  {invitation.status}
                </Badge>
                {invitation.error_message && (
                  <div className="text-xs text-destructive mt-1" title={invitation.error_message}>
                    Error occurred
                  </div>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {invitation.sent_at
                  ? formatDistanceToNow(new Date(invitation.sent_at), { addSuffix: true })
                  : formatDistanceToNow(new Date(invitation.created_at), { addSuffix: true })}
              </TableCell>
              <TableCell>
                {isReadOnly ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled
                            className="text-destructive/50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{readOnlyMessage}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeInvitation(invitation.id)}
                            className="text-destructive hover:text-destructive"
                          >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}