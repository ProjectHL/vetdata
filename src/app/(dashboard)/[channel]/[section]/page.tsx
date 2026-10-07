import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { notFound } from "next/navigation";
import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { findByPath } from "@/lib/nav";

export default async function SectionPage(props: PageProps<"/[channel]/[section]">) {
  const { channel, section } = await props.params;
  const { channel: ch, item } = findByPath(`/${channel}/${section}`);
  if (!item) notFound();

  return (
    <PageContainer>
      <PageHeader eyebrow={ch.title} title={item.title} />
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <Construction className="size-8" />
          <p>Esta sección del prototipo aún no tiene contenido.</p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
