import { GetListProducts } from "~/utils/list-products.server"
import type { ActionFunctionArgs } from "@remix-run/node";
import { requireUser } from "~/utils/requireUser";

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const user = await requireUser(request);

  const ListProductsParams = {
    userid: user.id,
    countperpage: formData.get("countperpage")?.toString(),
    page: formData.get("page")?.toString(),
    query: formData.get("query")?.toString() || null,
    sort: formData.get("sort")?.toString(),
  };

  const res = await GetListProducts(ListProductsParams);

  return {
    listproducts: res.data,
    maxpages: res.maxpages,
  };
};