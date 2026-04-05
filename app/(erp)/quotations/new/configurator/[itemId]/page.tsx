import { FullPageConfigurator } from "@/modules/product-configurator/components/full-page-configurator";

export default async function ConfiguratorPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  return <FullPageConfigurator itemId={itemId} />;
}
