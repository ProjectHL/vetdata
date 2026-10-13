import { RetailStatus } from "@/components/retail/status";

export default function RetailLayout({ children }: { children: React.ReactNode }) {
  return <RetailStatus>{children}</RetailStatus>;
}
