"use client";

import { Copy01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { format } from "date-fns";
import { useState } from "react";

import type { User } from "@repo/db/schemas/auth.schema";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { AdminUserRow } from "@/features/admin/queries";
import { roles, truncateId } from "@/lib/utils";

import { UserRowActions } from "./user-row-actions";

interface UserDetailDialogProps {
  user: AdminUserRow | null;
  currentUser: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserDetailDialog({
  user,
  currentUser,
  open,
  onOpenChange,
}: UserDetailDialogProps) {
  const [isCopied, setIsCopied] = useState(false);

  if (!user) return null;

  const status = user.banned ? "banned" : "active";

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(user.id);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>{user.name}</DialogTitle>
        </DialogHeader>

        {/* Header: Avatar + Name + Role/Status badges + Options */}
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="shrink-0">
            <UserAvatar
              user={user}
              className="size-16 rounded-xl border bg-muted text-muted-foreground"
            />
          </div>

          {/* Name + badges */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div>
              <h3 className="truncate text-lg leading-tight font-semibold">
                {user.name}
              </h3>
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {user.email}
            </p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <Badge
                variant={
                  user.role === roles.SUPERADMIN || user.role === roles.ADMIN
                    ? "default"
                    : "secondary"
                }
              >
                {user.role ?? "user"}
              </Badge>
              <Badge variant={status === "active" ? "default" : "destructive"}>
                {status}
              </Badge>
            </div>
          </div>

          {/* Options button */}
          <div className="shrink-0">
            <UserRowActions user={user} currentUser={currentUser} />
          </div>
        </div>

        <Separator />

        {/* Detail rows */}
        <div className="grid gap-3 text-sm">
          {/* User ID with copy button */}
          <div className="flex items-center justify-between gap-4">
            <span className="shrink-0 text-sm text-muted-foreground">
              User ID
            </span>
            <div className="flex items-center gap-1">
              <span className="font-mono text-xs">{truncateId(user.id)}</span>
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-6 shrink-0"
                onClick={handleCopyId}
                disabled={isCopied}
                aria-label={isCopied ? "Copied" : "Copy user ID"}
              >
                <HugeiconsIcon
                  icon={isCopied ? Tick01Icon : Copy01Icon}
                  className="size-3.5"
                />
              </Button>
            </div>
          </div>
          <DetailRow
            label="Email verified"
            value={user.emailVerified ? "Yes" : "No"}
          />
          <DetailRow
            label="Joined"
            value={format(user.createdAt, "MMM d, yyyy 'at' h:mm a")}
          />
          <DetailRow
            label="Last updated"
            value={format(user.updatedAt, "MMM d, yyyy 'at' h:mm a")}
          />
          {user.banned && user.banReason && (
            <DetailRow label="Ban reason" value={user.banReason} />
          )}
          {user.banned && user.banExpires && (
            <DetailRow
              label="Ban expires"
              value={format(user.banExpires, "MMM d, yyyy 'at' h:mm a")}
            />
          )}
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-xs">{value}</span>
    </div>
  );
}
