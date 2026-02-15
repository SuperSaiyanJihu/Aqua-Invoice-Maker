import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Student } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil, Users } from "lucide-react";

export function StudentManager() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [fullName, setFullName] = useState("");
  const [classDayTime, setClassDayTime] = useState("");
  const [ratePerClass, setRatePerClass] = useState("");

  const { data: students, isLoading } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { fullName: string; classDayTime: string; ratePerClass: string }) => {
      const res = await apiRequest("POST", "/api/students", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      toast({ title: "Student added", description: "The student has been saved." });
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { fullName: string; classDayTime: string; ratePerClass: string } }) => {
      const res = await apiRequest("PATCH", `/api/students/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      toast({ title: "Student updated", description: "Changes have been saved." });
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/students/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      toast({ title: "Student removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFullName("");
    setClassDayTime("");
    setRatePerClass("");
    setEditingStudent(null);
    setIsDialogOpen(false);
  };

  const openEdit = (student: Student) => {
    setEditingStudent(student);
    setFullName(student.fullName);
    setClassDayTime(student.classDayTime);
    setRatePerClass(student.ratePerClass);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!fullName.trim() || !classDayTime.trim() || !ratePerClass) {
      toast({ title: "Missing fields", description: "Please fill in all fields.", variant: "destructive" });
      return;
    }
    if (editingStudent) {
      updateMutation.mutate({ id: editingStudent.id, data: { fullName: fullName.trim(), classDayTime: classDayTime.trim(), ratePerClass } });
    } else {
      createMutation.mutate({ fullName: fullName.trim(), classDayTime: classDayTime.trim(), ratePerClass });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Students
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-student">
              <Plus className="h-4 w-4 mr-2" />
              Add Student
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingStudent ? "Edit Student" : "Add New Student"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="dialog-name">Full Name</Label>
                <Input id="dialog-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Jane Doe" data-testid="input-dialog-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dialog-class">Class Day/Time</Label>
                <Input id="dialog-class" value={classDayTime} onChange={(e) => setClassDayTime(e.target.value)} placeholder="e.g. Wednesday 5:30 PM" data-testid="input-dialog-class" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dialog-rate">Rate per Class ($)</Label>
                <Input id="dialog-rate" type="number" step="0.01" min="0" value={ratePerClass} onChange={(e) => setRatePerClass(e.target.value)} placeholder="e.g. 35.00" data-testid="input-dialog-rate" />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="w-full"
                data-testid="button-save-student"
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingStudent ? "Save Changes" : "Add Student"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !students || students.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No students yet.</p>
            <p className="text-sm text-muted-foreground">Add students to quickly select them when creating invoices.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Class Day/Time</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => (
                  <TableRow key={s.id} data-testid={`row-student-${s.id}`}>
                    <TableCell className="font-medium">{s.fullName}</TableCell>
                    <TableCell>{s.classDayTime}</TableCell>
                    <TableCell>${parseFloat(s.ratePerClass).toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(s)} data-testid={`button-edit-student-${s.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(s.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-student-${s.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
