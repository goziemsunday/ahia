import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

import {
  getProductById,
  getRelatedProducts,
} from "@/features/storefront/queries";
import { getCookie } from "@/lib/auth";
import { queryKeys } from "@/lib/query-keys";

import { ProductDetail } from "./product-detail";

const ProductDetailPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug: productId } = await params;
  const queryClient = new QueryClient();
  const cookie = await getCookie();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.product(productId),
    queryFn: () => getProductById(productId, cookie),
  });

  const product = queryClient.getQueryData<
    Awaited<ReturnType<typeof getProductById>>
  >(queryKeys.product(productId));

  if (product) {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.relatedProducts(productId),
      queryFn: () =>
        getRelatedProducts(productId, product.categories?.[0]?.slug, cookie),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductDetail productId={productId} />
    </HydrationBoundary>
  );
};

export default ProductDetailPage;
