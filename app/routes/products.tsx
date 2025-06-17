import { redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { sessionStorage } from "~/utils/session.server";
import { useEffect, useState, useCallback, useRef } from "react";

import { AppSidebar } from "~/components/app-sidebar";
import { SiteHeader } from "~/components/site-header";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { Button } from "~/components/ui/button";
import { toast } from "react-hot-toast";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableHeader,
  TableRow,
  TableCell,
  TableBody,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";

import { requireUser } from "~/utils/requireUser";
import { db } from "~/utils/db.server";
import { getUserProductUsageThisMonth } from "~/utils/analytic.server";

interface Integration {
  id: string;
  shopDomain: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const cookie = request.headers.get("Cookie");
  const session = await sessionStorage.getSession(cookie);
  const token = session.get("token");

  const productUsedLimit = await getUserProductUsageThisMonth(user.id);

  const integrations = await db.integration.findMany({
    where: { userId: user.id },
    select: { id: true, shopDomain: true },
  });

  return new Response(
    JSON.stringify({ user, token, integrations, productUsedLimit }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const cookie = request.headers.get("Cookie");
  const session = await sessionStorage.getSession(cookie);
  const token = session.get("token");

  if (token) await db.session.delete({ where: { token } });

  return redirect("/", {
    headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
  });
}

function Products({ integrations, productUsedLimit }: { integrations: Integration[], productUsedLimit:{} }) {
  const [products, setProducts] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [maxPage, setMaxPage] = useState(0);
  const [sort, setSort] = useState("updated_at desc");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [integrationId, setIntegrationId] = useState<string>("");

  

  // polling state
  const [isPolling, setIsPolling] = useState(false);
  const [pollInterval, setPollInterval] = useState(5000);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // set default integration
  useEffect(() => {
    if (integrations.length > 0 && !integrationId) {
      setIntegrationId(integrations[0].id);
    }
  }, [integrations, integrationId]);

  const fetchProducts = useCallback(async () => {
    //setLoading(true);
    try {
      const formData = new FormData();
      formData.append("query", query);
      formData.append("page", String(page));
      formData.append("sort", sort);
      formData.append("countperpage", "20");

      const res = await fetch("/api/list-products", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if(JSON.stringify(data.listproducts) !== JSON.stringify(products)){
        setProducts(data.listproducts || []);
        setMaxPage(data.maxpages || 0);
      }
      

      if (isPolling) {
        if (pollInterval < 60000) {
          const nextInterval = Math.min(pollInterval + 5000, 60000);
          setPollInterval(nextInterval);
          pollRef.current = setTimeout(fetchProducts, nextInterval);
        } else {
          setIsPolling(false);
          setPollInterval(5000);
          if (pollRef.current) clearTimeout(pollRef.current);
          toast.success("Updates completed");
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [query, page, sort, isPolling]);

  // initial load & cleanup
  useEffect(() => {
    fetchProducts();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [fetchProducts]);

  // when polling starts, trigger fetch
  useEffect(() => {
    if (isPolling) {
      // reset interval and start
      setPollInterval(5000);
      fetchProducts();
    }
  }, [isPolling, fetchProducts]);

  const handleBulkAction = (action: string) => {
    if (selected.size === 0) return;
    const formData = new FormData();
    formData.append("action", action);
    selected.forEach((id) => formData.append("id", id));
    formData.append("IntegrationId", integrationId);

    fetch("/api/product", {
      method: "POST",
      body: formData,
    }).then(() => {
      toast.success(`Action '${action}' completed.`);

      setSelected(new Set());
      if (action === "generation_by_ids") {
        setIsPolling(true);
      } else {
        fetchProducts();
      }
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  };

  return (
    <div className="container py-6">
      <Card className="p-4 space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4">
          <Input
            placeholder="Search products"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-sm"
          />
          <Select value={sort} onValueChange={(value) => setSort(value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title asc">Title A-Z</SelectItem>
              <SelectItem value="title desc">Title Z-A</SelectItem>
              <SelectItem value="created_at asc">Created Asc</SelectItem>
              <SelectItem value="created_at desc">Created Desc</SelectItem>
              <SelectItem value="updated_at asc">Updated Asc</SelectItem>
              <SelectItem value="updated_at desc">Updated Desc</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setPage(0)}>Search</Button>
          <Button
            variant="outline"
            onClick={() => handleBulkAction("generation_by_ids")}
            disabled={selected.size === 0 || (Boolean(productUsedLimit.available) && productUsedLimit.available < 1 && selected.size > productUsedLimit.available )}
          >
            Generate
          </Button>
          {integrations.length > 0 && (
            <Select value={integrationId} onValueChange={setIntegrationId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select shop" />
              </SelectTrigger>
              <SelectContent>
                {integrations.map((int) => (
                  <SelectItem key={int.id} value={int.id}>
                    {int.shopDomain}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            onClick={() => handleBulkAction("to_shop_by_ids")}
            disabled={selected.size === 0}
          >
            Add to Store
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleBulkAction("delete")}
            disabled={selected.size === 0}
          >
            Delete
          </Button>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading...</div>
        ) : products.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">No products found.</div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell></TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Images</TableCell>
                  <TableCell>Vendor</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Job</TableCell>
                  <TableCell>Updated At</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(product.id)}
                        onCheckedChange={() => toggleSelect(product.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <a href={`/product/${product.id}`}>{product.title}</a>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {product.images?.slice(0, 3).map((img: any) => (
                          <img
                            key={img.id}
                            src={`${img.imageUrl}?width=60&height=60`}
                            alt={img.name}
                            className="object-cover w-10 h-10 rounded"
                          />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{product.vendor}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{product.status}</Badge>
                    </TableCell>
                    <TableCell>{product.cronJob}</TableCell>
                    <TableCell>
                      {new Date(product.updatedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-between items-center pt-4">
              <Button variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page <= 0}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {maxPage}
              </span>
              <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= maxPage}>
                Next
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  const data = useLoaderData<{
    user: { name?: string; email: string; avatar: string; avatarf: string };
    token: string;
  }>();
  data.user.avatarf = "..";
  const { integrations } = useLoaderData<typeof loader>();
  const { productUsedLimit } = useLoaderData<typeof loader>();

  return (
    <div className="[--header-height:calc(theme(spacing.14))]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <AppSidebar user={data.user} />
          <SidebarInset>
            <div className="flex flex-1 flex-col gap-4 p-4">
              <Products integrations={integrations}  productUsedLimit={productUsedLimit}/>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
