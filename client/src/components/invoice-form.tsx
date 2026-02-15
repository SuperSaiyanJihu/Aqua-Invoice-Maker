import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Student } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { FileDown, X, CalendarDays, DollarSign, User, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";

export function InvoiceForm() {
  const { toast } = useToast();
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [manualName, setManualName] = useState("");
  const [manualClassDayTime, setManualClassDayTime] = useState("");
  const [manualRate, setManualRate] = useState("");
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [comments, setComments] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: students, isLoading: studentsLoading } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });

  const selectedStudent = students?.find((s) => s.id.toString() === selectedStudentId);

  const studentName = selectedStudent ? selectedStudent.fullName : manualName;
  const classDayTime = selectedStudent ? selectedStudent.classDayTime : manualClassDayTime;
  const ratePerClass = selectedStudent ? selectedStudent.ratePerClass : manualRate;

  const datesByMonth = selectedDates.reduce<Record<string, Date[]>>((acc, d) => {
    const key = format(d, "MMMM yyyy");
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  const totalCost = selectedDates.length * parseFloat(ratePerClass || "0");

  const handleDateSelect = (dates: Date[] | undefined) => {
    if (dates) {
      setSelectedDates(dates);
    }
  };

  const removeDate = (dateToRemove: Date) => {
    setSelectedDates((prev) => prev.filter((d) => d.getTime() !== dateToRemove.getTime()));
  };

  const handleGenerate = async () => {
    if (!studentName.trim()) {
      toast({ title: "Missing information", description: "Please enter a student name.", variant: "destructive" });
      return;
    }
    if (!classDayTime.trim()) {
      toast({ title: "Missing information", description: "Please enter class day/time.", variant: "destructive" });
      return;
    }
    if (!ratePerClass || parseFloat(ratePerClass) <= 0) {
      toast({ title: "Missing information", description: "Please enter a valid rate per class.", variant: "destructive" });
      return;
    }
    if (selectedDates.length === 0) {
      toast({ title: "Missing information", description: "Please select at least one attendance date.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const res = await apiRequest("POST", "/api/invoices/generate", {
        studentName: studentName.trim(),
        classDayTime: classDayTime.trim(),
        ratePerClass: ratePerClass.toString(),
        attendanceDates: selectedDates.map((d) => format(d, "yyyy-MM-dd")),
        comments: comments.trim() || null,
      });

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${studentName.trim().replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });

      toast({ title: "Invoice generated", description: "Your PDF invoice has been downloaded." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to generate invoice.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setSelectedStudentId("");
    setManualName("");
    setManualClassDayTime("");
    setManualRate("");
    setSelectedDates([]);
    setComments("");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Student Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {studentsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Select Saved Student</Label>
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                    <SelectTrigger data-testid="select-student">
                      <SelectValue placeholder="Choose a student or enter manually below" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Enter manually</SelectItem>
                      {students?.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()} data-testid={`select-student-${s.id}`}>
                          {s.fullName} — {s.classDayTime}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(!selectedStudentId || selectedStudentId === "manual") && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="studentName">Student Full Name</Label>
                      <Input
                        id="studentName"
                        placeholder="e.g. John Smith"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        data-testid="input-student-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="classDayTime">
                        <Clock className="h-3.5 w-3.5 inline mr-1" />
                        Class Day/Time or Drop Ins
                      </Label>
                      <Input
                        id="classDayTime"
                        placeholder="e.g. Monday 4:00 PM"
                        value={manualClassDayTime}
                        onChange={(e) => setManualClassDayTime(e.target.value)}
                        data-testid="input-class-day-time"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rate">
                        <DollarSign className="h-3.5 w-3.5 inline mr-1" />
                        Rate per Class ($)
                      </Label>
                      <Input
                        id="rate"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g. 35.00"
                        value={manualRate}
                        onChange={(e) => setManualRate(e.target.value)}
                        data-testid="input-rate"
                      />
                    </div>
                  </div>
                )}

                {selectedStudentId && selectedStudentId !== "manual" && selectedStudent && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-md bg-muted/50 p-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Student</p>
                      <p className="font-medium" data-testid="text-selected-student">{selectedStudent.fullName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Class</p>
                      <p className="font-medium">{selectedStudent.classDayTime}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Rate</p>
                      <p className="font-medium">${parseFloat(selectedStudent.ratePerClass).toFixed(2)}/class</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Attendance Dates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Click on dates the student attended class. Dates are automatically grouped by month on the invoice.
            </p>
            <div className="flex justify-center">
              <Calendar
                mode="multiple"
                selected={selectedDates}
                onSelect={handleDateSelect}
                className="rounded-md border"
                data-testid="calendar-attendance"
              />
            </div>

            {selectedDates.length > 0 && (
              <div className="mt-4 space-y-3">
                <Separator />
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm font-medium">{selectedDates.length} date{selectedDates.length !== 1 ? "s" : ""} selected</p>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedDates([])} data-testid="button-clear-dates">
                    Clear all
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedDates
                    .sort((a, b) => a.getTime() - b.getTime())
                    .map((d) => (
                      <Badge key={d.toISOString()} variant="secondary" className="gap-1">
                        {format(d, "MMM d, yyyy")}
                        <button onClick={() => removeDate(d)} className="ml-1" data-testid={`button-remove-date-${format(d, "yyyy-MM-dd")}`}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comments</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Add any specific notes or comments to appear on the invoice..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              data-testid="input-comments"
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="sticky top-6">
          <CardHeader>
            <CardTitle>Invoice Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between flex-wrap gap-2">
                <span className="text-muted-foreground">Student</span>
                <span className="font-medium" data-testid="text-summary-student">{studentName || "—"}</span>
              </div>
              <div className="flex justify-between flex-wrap gap-2">
                <span className="text-muted-foreground">Class</span>
                <span className="font-medium">{classDayTime || "—"}</span>
              </div>
              <div className="flex justify-between flex-wrap gap-2">
                <span className="text-muted-foreground">Rate</span>
                <span className="font-medium">{ratePerClass ? `$${parseFloat(ratePerClass).toFixed(2)}` : "—"}</span>
              </div>
              <Separator />
              <div className="flex justify-between flex-wrap gap-2">
                <span className="text-muted-foreground">Classes attended</span>
                <span className="font-medium" data-testid="text-summary-count">{selectedDates.length}</span>
              </div>

              {Object.entries(datesByMonth)
                .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                .map(([month, dates]) => (
                  <div key={month} className="pl-3 border-l-2 border-muted">
                    <p className="text-xs text-muted-foreground">{month}</p>
                    <p className="text-sm">{dates.length} class{dates.length !== 1 ? "es" : ""}</p>
                  </div>
                ))}

              <Separator />
              <div className="flex justify-between flex-wrap gap-2 pt-1">
                <span className="font-semibold text-base">Total</span>
                <span className="font-bold text-lg text-primary" data-testid="text-summary-total">
                  ${totalCost.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !studentName || !classDayTime || !ratePerClass || selectedDates.length === 0}
                className="w-full"
                data-testid="button-generate-invoice"
              >
                {isGenerating ? (
                  "Generating..."
                ) : (
                  <>
                    <FileDown className="h-4 w-4 mr-2" />
                    Generate PDF Invoice
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleReset} data-testid="button-reset">
                Reset Form
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
