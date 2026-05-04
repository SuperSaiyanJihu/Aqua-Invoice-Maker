import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Receipt } from "lucide-react";

export interface ReminderEditTarget {
  id: number;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  notes: string | null;
  documentType: string;
}

interface ReminderEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: ReminderEditTarget | null;
}

export function ReminderEditDialog({ open, onOpenChange, period }: ReminderEditDialogProps) {
  const { toast } = useToast();
  const [periodLabel, setPeriodLabel] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [documentType, setDocumentType] = useState<"invoice" | "receipt">("invoice");

  useEffect(() => {
    if (period) {
      setPeriodLabel(period.periodLabel);
      setPeriodStart(period.periodStart);
      setPeriodEnd(period.periodEnd);
      setNotes(period.notes || "");
      setDocumentType((period.documentType as "invoice" | "receipt") || "invoice");
    }
  }, [period, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!period) throw new Error("No reminder selected");
      const res = await apiRequest("PATCH", `/api/billing/periods/${period.id}`, {
        periodLabel: periodLabel.trim(),
        periodStart,
        periodEnd,
        notes: notes.trim() || null,
        documentType,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/archived"] });
      toast({ title: "Reminder updated" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!periodLabel.trim() || !periodStart || !periodEnd) {
      toast({ title: "Missing information", description: "Label, start, and end dates are required.", variant: "destructive" });
      return;
    }
    if (periodStart > periodEnd) {
      toast({ title: "Invalid dates", description: "Start date must be before or equal to end date.", variant: "destructive" });
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Reminder</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Document Type</Label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={documentType === "invoice" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setDocumentType("invoice")}
              >
                <FileText className="w-4 h-4 mr-2" />
                Invoice
              </Button>
              <Button
                type="button"
                variant={documentType === "receipt" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setDocumentType("receipt")}
              >
                <Receipt className="w-4 h-4 mr-2" />
                Receipt
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="periodLabel">Label</Label>
            <Input
              id="periodLabel"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="periodStart">Start Date</Label>
              <Input
                id="periodStart"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodEnd">End Date</Label>
              <Input
                id="periodEnd"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="periodNotes">Notes</Label>
            <Textarea
              id="periodNotes"
              rows={3}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
