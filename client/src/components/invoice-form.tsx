import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileDown, X, CalendarDays, DollarSign, User, Clock, CalendarRange } from "lucide-react";
import { format } from "date-fns";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAYS_OF_WEEK = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

export function InvoiceForm() {
  const { toast } = useToast();
  const [invoiceType, setInvoiceType] = useState<"attendance" | "monthly">("attendance");
  const [studentName, setStudentName] = useState("");
  const [classDayTime, setClassDayTime] = useState("");
  const [ratePerClass, setRatePerClass] = useState("");
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [monthlyMonth, setMonthlyMonth] = useState("");
  const [monthlyYear, setMonthlyYear] = useState(new Date().getFullYear().toString());
  const [monthlyDay, setMonthlyDay] = useState("");
  const [monthlyTotal, setMonthlyTotal] = useState("");
  const [comments, setComments] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const datesByMonth = selectedDates.reduce<Record<string, Date[]>>((acc, d) => {
    const key = format(d, "MMMM yyyy");
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  const totalCost = invoiceType === "attendance"
    ? selectedDates.length * parseFloat(ratePerClass || "0")
    : parseFloat(monthlyTotal || "0");

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

    if (invoiceType === "attendance") {
      if (!ratePerClass || parseFloat(ratePerClass) <= 0) {
        toast({ title: "Missing information", description: "Please enter a valid rate per class.", variant: "destructive" });
        return;
      }
      if (selectedDates.length === 0) {
        toast({ title: "Missing information", description: "Please select at least one attendance date.", variant: "destructive" });
        return;
      }
    } else {
      if (!monthlyMonth) {
        toast({ title: "Missing information", description: "Please select a month.", variant: "destructive" });
        return;
      }
      if (!monthlyYear) {
        toast({ title: "Missing information", description: "Please enter a year.", variant: "destructive" });
        return;
      }
      if (!monthlyDay) {
        toast({ title: "Missing information", description: "Please select a lesson day.", variant: "destructive" });
        return;
      }
      if (!monthlyTotal || parseFloat(monthlyTotal) <= 0) {
        toast({ title: "Missing information", description: "Please enter the monthly total.", variant: "destructive" });
        return;
      }
    }

    setIsGenerating(true);
    try {
      const body: any = {
        invoiceType,
        studentName: studentName.trim(),
        classDayTime: classDayTime.trim(),
        comments: comments.trim() || null,
      };

      if (invoiceType === "attendance") {
        body.ratePerClass = ratePerClass.toString();
        body.attendanceDates = selectedDates.map((d) => format(d, "yyyy-MM-dd"));
      } else {
        body.monthlyMonth = monthlyMonth;
        body.monthlyYear = monthlyYear;
        body.monthlyDay = monthlyDay;
        body.monthlyTotal = monthlyTotal;
      }

      const res = await apiRequest("POST", "/api/invoices/generate", body);

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
    setStudentName("");
    setClassDayTime("");
    setRatePerClass("");
    setSelectedDates([]);
    setMonthlyMonth("");
    setMonthlyYear(new Date().getFullYear().toString());
    setMonthlyDay("");
    setMonthlyTotal("");
    setComments("");
  };

  const isFormValid = invoiceType === "attendance"
    ? !!(studentName && classDayTime && ratePerClass && selectedDates.length > 0)
    : !!(studentName && classDayTime && monthlyMonth && monthlyYear && monthlyDay && monthlyTotal);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileDown className="h-5 w-5 text-primary" />
              Invoice Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button
                variant={invoiceType === "attendance" ? "default" : "outline"}
                onClick={() => setInvoiceType("attendance")}
                className="flex-1"
                data-testid="button-type-attendance"
              >
                <CalendarDays className="h-4 w-4 mr-2" />
                Attendance Dates
              </Button>
              <Button
                variant={invoiceType === "monthly" ? "default" : "outline"}
                onClick={() => setInvoiceType("monthly")}
                className="flex-1"
                data-testid="button-type-monthly"
              >
                <CalendarRange className="h-4 w-4 mr-2" />
                Monthly Charge
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Student Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="studentName">Student Full Name</Label>
                <Input
                  id="studentName"
                  placeholder="e.g. John Smith"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
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
                  value={classDayTime}
                  onChange={(e) => setClassDayTime(e.target.value)}
                  data-testid="input-class-day-time"
                />
              </div>
              {invoiceType === "attendance" && (
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
                    value={ratePerClass}
                    onChange={(e) => setRatePerClass(e.target.value)}
                    data-testid="input-rate"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {invoiceType === "attendance" ? (
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
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarRange className="h-5 w-5 text-primary" />
                Monthly Charge Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter the month, year, lesson day, and the total charge for this month.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Month</Label>
                  <Select value={monthlyMonth} onValueChange={setMonthlyMonth}>
                    <SelectTrigger data-testid="select-monthly-month">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthlyYear">Year</Label>
                  <Input
                    id="monthlyYear"
                    type="number"
                    min="2020"
                    max="2040"
                    value={monthlyYear}
                    onChange={(e) => setMonthlyYear(e.target.value)}
                    data-testid="input-monthly-year"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lesson Day</Label>
                  <Select value={monthlyDay} onValueChange={setMonthlyDay}>
                    <SelectTrigger data-testid="select-monthly-day">
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2 max-w-xs">
                <Label htmlFor="monthlyTotal">
                  <DollarSign className="h-3.5 w-3.5 inline mr-1" />
                  Monthly Total ($)
                </Label>
                <Input
                  id="monthlyTotal"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 140.00"
                  value={monthlyTotal}
                  onChange={(e) => setMonthlyTotal(e.target.value)}
                  data-testid="input-monthly-total"
                />
              </div>
            </CardContent>
          </Card>
        )}

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
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{invoiceType === "attendance" ? "Attendance Dates" : "Monthly Charge"}</span>
              </div>
              <div className="flex justify-between flex-wrap gap-2">
                <span className="text-muted-foreground">Student</span>
                <span className="font-medium" data-testid="text-summary-student">{studentName || "—"}</span>
              </div>
              <div className="flex justify-between flex-wrap gap-2">
                <span className="text-muted-foreground">Class</span>
                <span className="font-medium">{classDayTime || "—"}</span>
              </div>

              {invoiceType === "attendance" ? (
                <>
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
                </>
              ) : (
                <>
                  <Separator />
                  <div className="flex justify-between flex-wrap gap-2">
                    <span className="text-muted-foreground">Period</span>
                    <span className="font-medium">{monthlyMonth && monthlyYear ? `${monthlyMonth} ${monthlyYear}` : "—"}</span>
                  </div>
                  <div className="flex justify-between flex-wrap gap-2">
                    <span className="text-muted-foreground">Lesson Day</span>
                    <span className="font-medium">{monthlyDay || "—"}</span>
                  </div>
                </>
              )}

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
                disabled={isGenerating || !isFormValid}
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
