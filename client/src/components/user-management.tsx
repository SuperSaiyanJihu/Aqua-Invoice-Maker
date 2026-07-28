import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MailPlus, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UserData {
  id: number;
  username: string;
  email: string;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  createdAt: string;
}

export function UserManagement() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserData | null>(null);
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserData | null>(null);

  const { data: users, isLoading } = useQuery<UserData[]>({
    queryKey: ["/api/admin/users"],
  });

  const closeEditor = () => {
    setDialogOpen(false);
    setEditing(null);
    setEmail("");
    setIsAdmin(false);
  };

  const save = useMutation({
    mutationFn: async () => {
      const endpoint = editing ? `/api/admin/users/${editing.id}` : "/api/admin/users";
      const response = await apiRequest(editing ? "PUT" : "POST", endpoint, {
        email,
        isAdmin,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: editing ? "Access updated" : "User added",
        description: editing
          ? "The user's Invoice Creator permissions were updated."
          : "They can now sign in with Google using that email.",
      });
      closeEditor();
    },
    onError: (error: Error) =>
      toast({ title: "Unable to save user", description: error.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Access removed" });
      setDeleteTarget(null);
    },
    onError: (error: Error) => {
      toast({ title: "Unable to remove access", description: error.message, variant: "destructive" });
      setDeleteTarget(null);
    },
  });

  const openAdd = () => {
    setEditing(null);
    setEmail("");
    setIsAdmin(false);
    setDialogOpen(true);
  };

  const openEdit = (target: UserData) => {
    setEditing(target);
    setEmail(target.email);
    setIsAdmin(target.isAdmin);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>User Access</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-32 w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Invoice Creator Access
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Add an email to allow it to sign in with Google.
              </p>
            </div>
            <Button size="sm" onClick={openAdd}>
              <MailPlus className="mr-1 h-4 w-4" />
              Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((target) => {
                const isCurrent = target.email === currentUser?.email;
                return (
                  <TableRow key={target.id}>
                    <TableCell className="font-medium">
                      {target.email}
                      {isCurrent && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={target.isAdmin ? "default" : "secondary"}>
                        {target.isSuperAdmin ? "Superadmin" : target.isAdmin ? "Admin" : "User"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {target.isSuperAdmin
                        ? "Permanent"
                        : new Date(target.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(target)}
                        disabled={target.isSuperAdmin}
                        title="Edit access"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(target)}
                        disabled={isCurrent || target.isSuperAdmin}
                        title="Remove access"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!users?.length && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No additional users have been authorized.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit User Access" : "Add User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="user-email">Email address</Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="employee@goswimexcel.com"
                autoComplete="email"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is-admin">Administrator</Label>
                <p className="text-xs text-muted-foreground">
                  Administrators can add users and edit the email template.
                </p>
              </div>
              <Switch id="is-admin" checked={isAdmin} onCheckedChange={setIsAdmin} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditor}>Cancel</Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !email.trim()}
            >
              {save.isPending ? "Saving…" : editing ? "Save Changes" : "Grant Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remove Invoice Creator Access?</DialogTitle></DialogHeader>
          <p className="py-4">
            <strong>{deleteTarget?.email}</strong> will no longer be able to open this app.
            They can be re-added at any time.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}
              disabled={remove.isPending}
            >
              Remove Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
