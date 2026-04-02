import { useState } from "react";
import { InvoiceForm } from "@/components/invoice-form";
import { InvoiceHistory } from "@/components/invoice-history";
import { FamilyList } from "@/components/family-list";
import { BillingDashboard } from "@/components/billing-dashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Users, FileText, History } from "lucide-react";
import logoImg from "@assets/Logo_1772310414809.png";

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedFamilyId, setSelectedFamilyId] = useState<number | null>(null);
  const [selectedBillingPeriodId, setSelectedBillingPeriodId] = useState<number | null>(null);

  const handleCreateInvoiceFromFamily = (familyId: number, billingPeriodId?: number) => {
    setSelectedFamilyId(familyId);
    setSelectedBillingPeriodId(billingPeriodId || null);
    setActiveTab("create");
  };

  const handleFamilyUsed = () => {
    // Clear after form has consumed the selection
    setSelectedFamilyId(null);
    setSelectedBillingPeriodId(null);
  };

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
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="families" data-testid="tab-families">
              <Users className="h-4 w-4 mr-2" />
              Families
            </TabsTrigger>
            <TabsTrigger value="create" data-testid="tab-create">
              <FileText className="h-4 w-4 mr-2" />
              Create Document
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <History className="h-4 w-4 mr-2" />
              Document History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <BillingDashboard
              onCreateInvoice={(familyId, billingPeriodId) =>
                handleCreateInvoiceFromFamily(familyId, billingPeriodId)
              }
            />
          </TabsContent>

          <TabsContent value="families">
            <FamilyList
              onCreateInvoice={(familyId) =>
                handleCreateInvoiceFromFamily(familyId)
              }
            />
          </TabsContent>

          <TabsContent value="create">
            <InvoiceForm
              selectedFamilyId={selectedFamilyId}
              selectedBillingPeriodId={selectedBillingPeriodId}
              onFamilyUsed={handleFamilyUsed}
            />
          </TabsContent>

          <TabsContent value="history">
            <InvoiceHistory />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
