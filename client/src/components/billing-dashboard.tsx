import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { LayoutDashboard, FileText, Receipt, Mail, DollarSign, Download, Loader2, Eye, EyeOff } from "lucide-react";

interface DashboardPeriod {
  id: number;
  familyId: number;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  invoiceCreated: boolean;
  invoiceSent: boolean;
  invoiceId: number | null;
  notes: string | null;
  createdAt: string;
  familyName: string;
  emailAddresses: string[];
  billingType: string;
  ratePerClass: string | null;
  monthlyTotal: string | null;
  studentNames: string;
  classDayTime: string;
  documentType: string;
  brokerEmails: string[];
}

interface BillingDashboardProps {
  onCreateInvoice: (familyId: number, billingPeriodId: number) => void;
}

export function BillingDashboard({ onCreateInvoice }: BillingDashboardProps) {
  const { toast } = useToast();
  const [showCompleted, setShowCompleted] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const { data: periods, isLoading } = useQuery<DashboardPeriod[]>({
    queryKey: ["/api/billing/dashboard"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: number; field: "invoiceCreated" | "invoiceSent"; value: boolean }) => {
      const res = await apiRequest("PATCH", `/api/billing/periods/${id}`, { [field]: value });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/dashboard"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleDownloadInvoice = async (invoiceId: number) => {
    setDownloadingId(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to download");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredPeriods = periods?.filter((p) => {
    if (showCompleted) return true;
    return !p.invoiceCreated || !p.invoiceSent;
  });

  const needsAttention = periods?.filter((p) => !p.invoiceCreated).length || 0;
  const needsSending = periods?.filter((p) => p.invoiceCreated && !p.invoiceSent).length || 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 flex-wrap gap-2">
        <CardTitle className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          Billing Dashboard
          {needsAttention > 0 && (
            <Badge variant="destructive" className="ml-2">{needsAttention} to create</Badge>
          )}
          {needsSending > 0 && (
            <Badge variant="default" className="ml-1">{needsSending} to send</Badge>
          )}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCompleted(!showCompleted)}
        >
          {showCompleted ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
          {showCompleted ? "Hide completed" : "Show completed"}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !filteredPeriods || filteredPeriods.length === 0 ? (
          <div className="text-center py-12">
            <LayoutDashboard className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              {!periods || periods.length === 0
                ? "No billing periods yet."
                : "All invoices are created and sent!"
              }
            </p>
            <p className="text-sm text-muted-foreground">
              {!periods || periods.length === 0
                ? "Add families with reminder schedules to see upcoming invoices here."
                : "Toggle 'Show completed' to see past billing periods."
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPeriods.map((period) => {
              const bothDone = period.invoiceCreated && period.invoiceSent;
              const createdNotSent = period.invoiceCreated && !period.invoiceSent;

              return (
                <Card
                  key={period.id}
                  className={
                    bothDone
                      ? "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20"
                      : createdNotSent
                        ? "border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20"
                        : "border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20"
                  }
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      {/* Info */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-base">{period.familyName}</h3>
                          <Badge variant="outline">{period.periodLabel}</Badge>
                          <Badge variant="secondary">
                            {period.billingType === "monthly" ? "Monthly" : "Attendance"}
                          </Badge>
                          <Badge variant={period.documentType === "receipt" ? "outline" : "secondary"}>
                            {period.documentType === "receipt" ? "Receipt" : "Invoice"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5" />
                            {period.billingType === "attendance"
                              ? period.ratePerClass ? `$${parseFloat(period.ratePerClass).toFixed(2)}/class` : "Rate not set"
                              : period.monthlyTotal ? `$${parseFloat(period.monthlyTotal).toFixed(2)}` : "Amount not set"
                            }
                          </span>
                          {period.emailAddresses?.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5" />
                              {period.emailAddresses.join(", ")}
                            </span>
                          )}
                          {period.brokerEmails?.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5 text-blue-500" />
                              <span className="text-blue-600 dark:text-blue-400">Broker: {period.brokerEmails.join(", ")}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {period.studentNames} — {period.classDayTime}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-3 sm:items-end">
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={period.invoiceCreated}
                              onCheckedChange={(checked) =>
                                toggleMutation.mutate({
                                  id: period.id,
                                  field: "invoiceCreated",
                                  value: !!checked,
                                })
                              }
                            />
                            <span className="text-sm">Created</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={period.invoiceSent}
                              onCheckedChange={(checked) =>
                                toggleMutation.mutate({
                                  id: period.id,
                                  field: "invoiceSent",
                                  value: !!checked,
                                })
                              }
                            />
                            <span className="text-sm">Sent</span>
                          </label>
                        </div>
                        <div className="flex gap-2">
                          {!period.invoiceCreated && (
                            <Button
                              size="sm"
                              onClick={() => onCreateInvoice(period.familyId, period.id)}
                            >
                              {period.documentType === "receipt" ? (
                                <Receipt className="h-4 w-4 mr-2" />
                              ) : (
                                <FileText className="h-4 w-4 mr-2" />
                              )}
                              Create {period.documentType === "receipt" ? "Receipt" : "Invoice"}
                            </Button>
                          )}
                          {period.invoiceId && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownloadInvoice(period.invoiceId!)}
                              disabled={downloadingId === period.invoiceId}
                            >
                              {downloadingId === period.invoiceId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4 mr-2" />
                              )}
                              Download PDF
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
