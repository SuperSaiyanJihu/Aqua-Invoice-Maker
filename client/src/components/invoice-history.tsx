import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Invoice } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, Download, Trash2, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

export function InvoiceHistory() {
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Record deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleDownload = async (invoice: Invoice) => {
    setDownloadingId(invoice.id);
    try {
      // Use the new PDF endpoint that doesn't create duplicates
      const res = await fetch(`/api/invoices/${invoice.id}/pdf`, {
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to download document");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      const docType = invoice.documentType || "invoice";
      a.download = `${docType}-${invoice.invoiceNumber}.pdf`;
      
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Document History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !invoices || invoices.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No documents generated yet.</p>
            <p className="text-sm text-muted-foreground">Create your first document from the Create Document tab.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const isMonthly = inv.invoiceType === "monthly";
                  const isReceipt = inv.documentType === "receipt";
                  const total = isMonthly
                    ? parseFloat(inv.monthlyTotal || "0")
                    : inv.attendanceDates.length * parseFloat(inv.ratePerClass);
                  const isDownloading = downloadingId === inv.id;
                  
                  return (
                    <TableRow key={inv.id} data-testid={`row-invoice-${inv.id}`}>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(inv.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {inv.invoiceNumber}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isReceipt ? "default" : "outline"} data-testid={`badge-doc-type-${inv.id}`}>
                          {isReceipt ? "Receipt" : "Invoice"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {isMonthly ? "Monthly" : "Attendance"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{inv.studentName}</TableCell>
                      <TableCell>
                        {isMonthly
                          ? `${inv.monthlyMonth} ${inv.monthlyYear}`
                          : `${inv.attendanceDates.length} classes`}
                      </TableCell>
                      <TableCell className="font-medium">${total.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => handleDownload(inv)} 
                            disabled={isDownloading}
                            data-testid={`button-download-invoice-${inv.id}`}
                          >
                            {isDownloading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(inv.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-invoice-${inv.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
