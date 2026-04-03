import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Family } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Plus, Pencil, Trash2, FileText } from "lucide-react";
import { FamilyDialog } from "./family-dialog";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface FamilyListProps {
  onCreateInvoice: (familyId: number) => void;
}

export function FamilyList({ onCreateInvoice }: FamilyListProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFamily, setEditingFamily] = useState<Family | null>(null);

  const { data: families, isLoading } = useQuery<Family[]>({
    queryKey: ["/api/families"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/families/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/dashboard"] });
      toast({ title: "Family deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleEdit = (family: Family) => {
    setEditingFamily(family);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingFamily(null);
    setDialogOpen(true);
  };

  const formatSchedule = (family: Family): string => {
    if (family.reminderFrequency === "none") return "No reminders";
    if (family.reminderFrequency === "monthly") {
      const day = family.reminderDayOfMonth || 1;
      return `Monthly (${day}${getOrdinalSuffix(day)})`;
    }
    if (family.reminderFrequency === "biweekly") {
      return "Every 2 weeks";
    }
    if (family.reminderFrequency === "weekly") {
      const day = DAYS_OF_WEEK[family.reminderDayOfWeek ?? 1];
      return `Weekly (${day})`;
    }
    return family.reminderFrequency;
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Families
          </CardTitle>
          <Button onClick={handleAdd} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Family
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !families || families.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No families added yet.</p>
              <p className="text-sm text-muted-foreground">Add your first family to start tracking invoices.</p>
              <Button className="mt-4" onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Add Family
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Family</TableHead>
                    <TableHead>Student(s)</TableHead>
                    <TableHead>Billing</TableHead>
                    <TableHead>Rate/Amount</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Email(s)</TableHead>
                    <TableHead className="w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {families.map((family) => (
                    <TableRow key={family.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {family.familyName}
                          {!family.isActive && (
                            <Badge variant="outline" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{family.studentNames}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="secondary">
                            {family.billingType === "monthly" ? "Monthly" : "Attendance"}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {family.documentType === "receipt" ? "Receipt" : "Invoice"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {family.billingType === "attendance"
                          ? family.ratePerClass ? `$${parseFloat(family.ratePerClass).toFixed(2)}/class` : "—"
                          : family.monthlyTotal ? `$${parseFloat(family.monthlyTotal).toFixed(2)}/mo` : "—"
                        }
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatSchedule(family)}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px]">
                        <div className="space-y-1">
                          <div className="truncate">
                            {family.emailAddresses?.length > 0
                              ? family.emailAddresses.join(", ")
                              : "—"
                            }
                          </div>
                          {family.brokerEmails?.length > 0 && (
                            <div className="truncate text-blue-600 dark:text-blue-400 text-xs">
                              Broker: {family.brokerEmails.join(", ")}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Create Invoice"
                            onClick={() => onCreateInvoice(family.id)}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Edit"
                            onClick={() => handleEdit(family)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Delete"
                            onClick={() => deleteMutation.mutate(family.id)}
                            disabled={deleteMutation.isPending}
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

      <FamilyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        family={editingFamily}
      />
    </>
  );
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
