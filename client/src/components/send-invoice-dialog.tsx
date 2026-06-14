import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";

interface EmailLog {
  id: number;
  status: string;
  toAddresses: string[];
  ccAddresses: string[];
  createdAt: string;
}

interface SendInvoiceDialogProps {
  invoiceId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentLabel: string; // "Invoice" | "Receipt"
  studentName: string;
  defaultTo: string[];
  defaultCc: string[];
  billingPeriodId?: number | null;
  onSent?: (info: { to: string[]; cc: string[] }) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmails(value: string): string[] {
  return value
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}

export function SendInvoiceDialog({
  invoiceId,
  open,
  onOpenChange,
  documentLabel,
  studentName,
  defaultTo,
  defaultCc,
  billingPeriodId,
  onSent,
}: SendInvoiceDialogProps) {
  const { toast } = useToast();
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");

  // Reset the editable fields whenever the dialog opens for a (possibly new) invoice.
  useEffect(() => {
    if (open) {
      setTo(defaultTo.join(", "));
      setCc(defaultCc.join(", "));
    }
  }, [open, invoiceId, defaultTo, defaultCc]);

  const { data: priorLogs } = useQuery<EmailLog[]>({
    queryKey: [`/api/invoices/${invoiceId}/emails`],
    enabled: open && invoiceId !== null,
  });

  const lastSent = priorLogs?.find((l) => l.status === "sent");

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/invoices/${invoiceId}/send`, {
        to: parseEmails(to),
        cc: parseEmails(cc),
        billingPeriodId: billingPeriodId ?? null,
      });
      return res.json();
    },
    onSuccess: (data: { to: string[]; cc: string[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/archived"] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${invoiceId}/emails`] });
      const recips = [...(data.to || []), ...(data.cc || [])].join(", ");
      toast({ title: "Email sent", description: `Sent to ${recips}` });
      onOpenChange(false);
      onSent?.({ to: data.to || [], cc: data.cc || [] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    },
  });

  const toEmails = parseEmails(to);
  const ccEmails = parseEmails(cc);
  const invalidTo = toEmails.filter((e) => !EMAIL_RE.test(e));
  const invalidCc = ccEmails.filter((e) => !EMAIL_RE.test(e));
  const canSend =
    toEmails.length > 0 && invalidTo.length === 0 && invalidCc.length === 0 && !sendMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !sendMutation.isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send {documentLabel.toLowerCase()} by email</DialogTitle>
          <DialogDescription>
            {studentName ? `${documentLabel} for ${studentName}. ` : ""}
            The PDF will be attached and replies go to your reply-to address.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="send-to">To</Label>
            <Input
              id="send-to"
              placeholder="parent@example.com, second@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Separate multiple addresses with commas.</p>
            {invalidTo.length > 0 && (
              <p className="text-xs text-destructive">Invalid: {invalidTo.join(", ")}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="send-cc">CC (optional)</Label>
            <Input
              id="send-cc"
              placeholder="broker@example.com"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
            />
            {invalidCc.length > 0 && (
              <p className="text-xs text-destructive">Invalid: {invalidCc.join(", ")}</p>
            )}
          </div>

          {toEmails.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No recipient on file for this document. Enter an email address above to send it.
            </p>
          )}

          {lastSent && (
            <p className="text-xs text-muted-foreground">
              Last sent {new Date(lastSent.createdAt).toLocaleString()} to{" "}
              {lastSent.toAddresses.join(", ")}.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sendMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => sendMutation.mutate()} disabled={!canSend}>
            {sendMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
