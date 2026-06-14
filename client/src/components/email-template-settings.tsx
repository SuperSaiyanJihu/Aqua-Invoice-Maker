import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, RotateCcw } from "lucide-react";
import {
  PLACEHOLDERS,
  SAMPLE_VARS,
  DEFAULT_EMAIL_TEMPLATE,
  renderTemplate,
  type EmailTemplate,
} from "@shared/email-template";

export function EmailTemplateSettings() {
  const { toast } = useToast();
  // Seed with the default so the editor always has content to edit/save, even if
  // the GET hasn't returned yet (or errors). Overwritten by the saved value below.
  const [subject, setSubject] = useState(DEFAULT_EMAIL_TEMPLATE.subject);
  const [body, setBody] = useState(DEFAULT_EMAIL_TEMPLATE.body);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const { data: template, isLoading, error } = useQuery<EmailTemplate>({
    queryKey: ["/api/settings/email-template"],
  });

  // Seed local editor state when the template loads.
  useEffect(() => {
    if (template) {
      setSubject(template.subject);
      setBody(template.body);
    }
  }, [template]);

  const saveMutation = useMutation({
    mutationFn: async (data: EmailTemplate) => {
      const res = await apiRequest("PUT", "/api/settings/email-template", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/email-template"] });
      toast({ title: "Template saved", description: "New emails will use this wording." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Insert a {placeholder} at the body textarea's cursor (or append to subject).
  const insertPlaceholder = (token: string) => {
    const snippet = `{${token}}`;
    const el = bodyRef.current;
    if (!el) {
      setBody((b) => b + snippet);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + snippet + body.slice(end);
    setBody(next);
    // Restore focus and place cursor after the inserted snippet.
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const resetToDefault = () => {
    setSubject(DEFAULT_EMAIL_TEMPLATE.subject);
    setBody(DEFAULT_EMAIL_TEMPLATE.body);
  };

  const canSave = subject.trim().length > 0 && body.trim().length > 0 && !saveMutation.isPending;
  const previewSubject = renderTemplate(subject, SAMPLE_VARS);
  const previewBody = renderTemplate(body, SAMPLE_VARS);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Template
          </CardTitle>
          <CardDescription>
            Edit the message sent when you email an invoice or receipt. Placeholders in{" "}
            <code>{"{braces}"}</code> are filled in automatically for each email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div
              className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              data-testid="text-template-load-error"
            >
              Couldn't load the saved template ({(error as Error).message}). Showing the default — you can still edit and save.
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              data-testid="input-template-subject"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-body">Body</Label>
            <Textarea
              id="email-body"
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={14}
              className="font-mono text-sm"
              data-testid="input-template-body"
            />
          </div>

          <div className="space-y-2">
            <Label>Placeholders (click to insert)</Label>
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDERS.map((p) => (
                <Badge
                  key={p.token}
                  variant="secondary"
                  className="cursor-pointer hover:bg-secondary/70"
                  title={p.description}
                  onClick={() => insertPlaceholder(p.token)}
                  data-testid={`badge-placeholder-${p.token}`}
                >
                  {`{${p.token}}`}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              onClick={() => saveMutation.mutate({ subject, body })}
              disabled={!canSave}
              data-testid="button-save-template"
            >
              {saveMutation.isPending ? "Saving..." : "Save template"}
            </Button>
            <Button variant="outline" onClick={resetToDefault} data-testid="button-reset-template">
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset to default
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>Using sample data — this is how a real email will look.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Subject: </span>
            <span className="font-medium" data-testid="text-preview-subject">{previewSubject}</span>
          </div>
          <div
            className="rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap"
            data-testid="text-preview-body"
          >
            {previewBody}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
