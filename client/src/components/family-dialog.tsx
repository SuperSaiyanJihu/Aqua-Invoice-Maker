import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Family } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { CalendarDays, CalendarRange } from "lucide-react";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface FamilyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  family?: Family | null;
}

export function FamilyDialog({ open, onOpenChange, family }: FamilyDialogProps) {
  const { toast } = useToast();
  const isEditing = !!family;

  const [familyName, setFamilyName] = useState("");
  const [studentNames, setStudentNames] = useState("");
  const [classDayTime, setClassDayTime] = useState("");
  const [billingType, setBillingType] = useState<"attendance" | "monthly">("attendance");
  const [ratePerClass, setRatePerClass] = useState("");
  const [monthlyTotal, setMonthlyTotal] = useState("");
  const [emailAddresses, setEmailAddresses] = useState("");
  const [notes, setNotes] = useState("");
  const [reminderFrequency, setReminderFrequency] = useState<"monthly" | "biweekly" | "weekly" | "none">("none");
  const [reminderDayOfMonth, setReminderDayOfMonth] = useState<string>("1");
  const [reminderDayOfWeek, setReminderDayOfWeek] = useState<string>("1");
  const [reminderAnchorDate, setReminderAnchorDate] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (family) {
      setFamilyName(family.familyName);
      setStudentNames(family.studentNames);
      setClassDayTime(family.classDayTime);
      setBillingType(family.billingType as "attendance" | "monthly");
      setRatePerClass(family.ratePerClass || "");
      setMonthlyTotal(family.monthlyTotal || "");
      setEmailAddresses((family.emailAddresses || []).join(", "));
      setNotes(family.notes || "");
      setReminderFrequency(family.reminderFrequency as any || "none");
      setReminderDayOfMonth(family.reminderDayOfMonth?.toString() || "1");
      setReminderDayOfWeek(family.reminderDayOfWeek?.toString() || "1");
      setReminderAnchorDate(family.reminderAnchorDate || "");
      setIsActive(family.isActive);
    } else {
      resetForm();
    }
  }, [family, open]);

  const resetForm = () => {
    setFamilyName("");
    setStudentNames("");
    setClassDayTime("");
    setBillingType("attendance");
    setRatePerClass("");
    setMonthlyTotal("");
    setEmailAddresses("");
    setNotes("");
    setReminderFrequency("none");
    setReminderDayOfMonth("1");
    setReminderDayOfWeek("1");
    setReminderAnchorDate("");
    setIsActive(true);
  };

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEditing) {
        const res = await apiRequest("PUT", `/api/families/${family!.id}`, data);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/families", data);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/families"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/dashboard"] });
      toast({ title: isEditing ? "Family updated" : "Family added" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!familyName.trim() || !studentNames.trim() || !classDayTime.trim()) {
      toast({ title: "Missing information", description: "Please fill in the family name, student name(s), and class info.", variant: "destructive" });
      return;
    }

    const emails = emailAddresses
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    const data: any = {
      familyName: familyName.trim(),
      studentNames: studentNames.trim(),
      classDayTime: classDayTime.trim(),
      billingType,
      ratePerClass: billingType === "attendance" && ratePerClass ? ratePerClass : null,
      monthlyTotal: billingType === "monthly" && monthlyTotal ? monthlyTotal : null,
      emailAddresses: emails,
      notes: notes.trim() || null,
      reminderFrequency,
      reminderDayOfMonth: reminderFrequency === "monthly" ? parseInt(reminderDayOfMonth) : null,
      reminderDayOfWeek: (reminderFrequency === "weekly" || reminderFrequency === "biweekly") ? parseInt(reminderDayOfWeek) : null,
      reminderAnchorDate: reminderFrequency === "biweekly" && reminderAnchorDate ? reminderAnchorDate : null,
      isActive,
    };

    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Family" : "Add Family"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="familyName">Family Name</Label>
                <Input
                  id="familyName"
                  placeholder="e.g. Smith Family"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="studentNames">Student Name(s)</Label>
                <Input
                  id="studentNames"
                  placeholder="e.g. John Smith"
                  value={studentNames}
                  onChange={(e) => setStudentNames(e.target.value)}
                  maxLength={200}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="classDayTime">Class Day/Time</Label>
              <Input
                id="classDayTime"
                placeholder="e.g. Monday 4:00 PM"
                value={classDayTime}
                onChange={(e) => setClassDayTime(e.target.value)}
                maxLength={100}
              />
            </div>
          </div>

          <Separator />

          {/* Billing Info */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Billing</Label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={billingType === "attendance" ? "default" : "outline"}
                onClick={() => setBillingType("attendance")}
                className="flex-1"
              >
                <CalendarDays className="h-4 w-4 mr-2" />
                Attendance
              </Button>
              <Button
                type="button"
                variant={billingType === "monthly" ? "default" : "outline"}
                onClick={() => setBillingType("monthly")}
                className="flex-1"
              >
                <CalendarRange className="h-4 w-4 mr-2" />
                Monthly
              </Button>
            </div>
            {billingType === "attendance" ? (
              <div className="space-y-2">
                <Label htmlFor="ratePerClass">Rate per Class ($)</Label>
                <Input
                  id="ratePerClass"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 35.00"
                  value={ratePerClass}
                  onChange={(e) => setRatePerClass(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="monthlyTotal">Monthly Total ($)</Label>
                <Input
                  id="monthlyTotal"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 140.00"
                  value={monthlyTotal}
                  onChange={(e) => setMonthlyTotal(e.target.value)}
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Contact */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emailAddresses">Email Address(es)</Label>
              <Input
                id="emailAddresses"
                placeholder="e.g. parent@email.com, parent2@email.com"
                value={emailAddresses}
                onChange={(e) => setEmailAddresses(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Separate multiple emails with commas</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any notes about this family's billing preferences, special instructions, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={1000}
              />
            </div>
          </div>

          <Separator />

          {/* Reminder Schedule */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Invoice Reminder Schedule</Label>
            <div className="space-y-2">
              <Label htmlFor="reminderFrequency">Frequency</Label>
              <Select value={reminderFrequency} onValueChange={(v: any) => setReminderFrequency(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No reminders</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reminderFrequency === "monthly" && (
              <div className="space-y-2">
                <Label>Day of Month</Label>
                <Select value={reminderDayOfMonth} onValueChange={setReminderDayOfMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        {i + 1}{getOrdinalSuffix(i + 1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">When should the invoice reminder appear each month?</p>
              </div>
            )}

            {(reminderFrequency === "weekly" || reminderFrequency === "biweekly") && (
              <div className="space-y-2">
                <Label>Day of Week</Label>
                <Select value={reminderDayOfWeek} onValueChange={setReminderDayOfWeek}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day, i) => (
                      <SelectItem key={i} value={i.toString()}>{day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {reminderFrequency === "biweekly" && (
              <div className="space-y-2">
                <Label htmlFor="anchorDate">Billing Start Date</Label>
                <Input
                  id="anchorDate"
                  type="date"
                  value={reminderAnchorDate}
                  onChange={(e) => setReminderAnchorDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">The date the first 2-week billing period starts from</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Active Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Active</Label>
              <p className="text-xs text-muted-foreground">Inactive families won't generate reminders</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : isEditing ? "Save Changes" : "Add Family"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
