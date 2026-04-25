import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ShieldCheck, Plus, Pencil, Trash2, RotateCcw } from "lucide-react";

interface UserData {
  id: number;
  username: string;
  isAdmin: boolean;
  mustChangePin: boolean;
  createdAt: string;
  updatedAt: string;
}

export function UserManagement() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [resetPinConfirmId, setResetPinConfirmId] = useState<number | null>(null);

  // Form state
  const [username, setUsername] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const { data: users, isLoading } = useQuery<UserData[]>({
    queryKey: ["/api/admin/users"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { username: string; isAdmin: boolean }) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User created", description: "Their PIN is set to 0000 — they'll be prompted to change it on first login." });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { username?: string; isAdmin?: boolean } }) => {
      const res = await apiRequest("PUT", `/api/admin/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "User updated" });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User deleted" });
      setDeleteConfirmId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setDeleteConfirmId(null);
    },
  });

  const resetPinMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/reset-pin`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "PIN reset", description: "User's PIN has been reset to 0000. They'll be prompted to change it on next login." });
      setResetPinConfirmId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setResetPinConfirmId(null);
    },
  });

  const openAdd = () => {
    setEditingUser(null);
    setUsername("");
    setIsAdmin(false);
    setDialogOpen(true);
  };

  const openEdit = (user: UserData) => {
    setEditingUser(user);
    setUsername(user.username);
    setIsAdmin(user.isAdmin);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingUser(null);
    setUsername("");
    setIsAdmin(false);
  };

  const handleSubmit = () => {
    if (editingUser) {
      const data: { username?: string; isAdmin?: boolean } = {};
      if (username !== editingUser.username) data.username = username;
      if (isAdmin !== editingUser.isAdmin) data.isAdmin = isAdmin;
      updateMutation.mutate({ id: editingUser.id, data });
    } else {
      createMutation.mutate({ username, isAdmin });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              User Management
            </CardTitle>
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" />
              Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>PIN Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.username}
                    {u.username === currentUser?.username && (
                      <span className="text-xs text-muted-foreground ml-2">(you)</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.isAdmin ? (
                      <Badge variant="default">Admin</Badge>
                    ) : (
                      <Badge variant="secondary">User</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.mustChangePin ? (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">Pending change</Badge>
                    ) : (
                      <Badge variant="outline" className="text-green-600 border-green-300">Set</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Reset PIN to 0000"
                        onClick={() => setResetPinConfirmId(u.id)}
                        disabled={u.username === currentUser?.username}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmId(u.id)}
                        disabled={u.username === currentUser?.username}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!users || users.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
              />
            </div>
            {!editingUser && (
              <p className="text-sm text-muted-foreground rounded-md bg-muted px-3 py-2">
                New user will be assigned PIN <strong>0000</strong> and prompted to set a new PIN on first login.
              </p>
            )}
            <div className="flex items-center justify-between">
              <Label htmlFor="isAdmin">Admin privileges</Label>
              <Switch
                id="isAdmin"
                checked={isAdmin}
                onCheckedChange={setIsAdmin}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !username}
            >
              {isSubmitting ? "Saving..." : editingUser ? "Save Changes" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset PIN Confirmation Dialog */}
      <Dialog open={resetPinConfirmId !== null} onOpenChange={(open) => { if (!open) setResetPinConfirmId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset PIN</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Reset PIN for <strong>{users?.find(u => u.id === resetPinConfirmId)?.username}</strong> back to <strong>0000</strong>? They will be prompted to set a new PIN on next login.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPinConfirmId(null)}>Cancel</Button>
            <Button
              onClick={() => resetPinConfirmId && resetPinMutation.mutate(resetPinConfirmId)}
              disabled={resetPinMutation.isPending}
            >
              {resetPinMutation.isPending ? "Resetting..." : "Reset PIN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Are you sure you want to delete user "{users?.find(u => u.id === deleteConfirmId)?.username}"? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
