import { InvoiceForm } from "@/components/invoice-form";
import { InvoiceHistory } from "@/components/invoice-history";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileText, History, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import logoImg from "@assets/Logo_1772310414809.png";

export default function Home() {
  const { user, logout, isLoggingOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4 flex-wrap">
          <img
            src={logoImg}
            alt="Excel Aquatics"
            className="h-12 w-auto"
            data-testid="img-logo"
          />
          <div>
            <h1 className="text-xl font-semibold" data-testid="text-app-title">
              Excel Aquatics
            </h1>
            <p className="text-sm text-muted-foreground">
              Document Management — Colonie, NY
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {user?.username}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout()}
              disabled={isLoggingOut}
            >
              <LogOut className="h-4 w-4 mr-1" />
              {isLoggingOut ? "Signing out..." : "Sign Out"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="create" className="space-y-6">
          <TabsList>
            <TabsTrigger value="create" data-testid="tab-create">
              <FileText className="h-4 w-4 mr-2" />
              Create Document
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <History className="h-4 w-4 mr-2" />
              Document History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <InvoiceForm />
          </TabsContent>

          <TabsContent value="history">
            <InvoiceHistory />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
