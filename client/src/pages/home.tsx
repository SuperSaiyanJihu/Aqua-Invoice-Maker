import { InvoiceForm } from "@/components/invoice-form";
import { InvoiceHistory } from "@/components/invoice-history";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, History } from "lucide-react";
import logoImg from "@assets/Logo_1772310414809.png";

export default function Home() {
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
              Invoice Management — Colonie, NY
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="create" className="space-y-6">
          <TabsList>
            <TabsTrigger value="create" data-testid="tab-create">
              <FileText className="h-4 w-4 mr-2" />
              Create Invoice
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <History className="h-4 w-4 mr-2" />
              Invoice History
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
