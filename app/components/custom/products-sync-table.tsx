// components/custom/products-sync-table.tsx
import { useEffect, useState, useCallback } from "react";
import type { Integration } from "@prisma/client";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Table, TableHeader, TableRow, TableCell, TableBody } from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "~/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger} from "~/components/ui/popover";
import { Checkbox } from "../ui/checkbox";

interface ProductsSyncTableProps {
  integrations: Integration[];
}

export function ProductsSyncTable({ integrations }: ProductsSyncTableProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [integrationId, setIntegrationId] = useState(integrations[0]?.id || "");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("updated_at desc");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [paginationEvent, setPaginationEvent] = useState("initial");
  const [loading, setLoading] = useState(false);

  const sortOptions = [
    { label: "Title A-Z", value: "title asc" },
    { label: "Title Z-A", value: "title desc" },
    { label: "Created at ↑", value: "created_at asc" },
    { label: "Created at ↓", value: "created_at desc" },
    { label: "Updated at ↑", value: "updated_at asc" },
    { label: "Updated at ↓", value: "updated_at desc" },
    { label: "Vendor A-Z", value: "vendor asc" },
    { label: "Vendor Z-A", value: "vendor desc" },
  ];

  const fetchProducts = useCallback(() => {
    if (!integrationId) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("action", "get-from-shopify");
    formData.append("IntegrationId", integrationId);
    if (query) formData.append("queryValue", query);
    if (sort) formData.append("sortSelected", sort);
    if (cursor) formData.append("cursor", cursor);
    if (paginationEvent) formData.append("paginationEvent", paginationEvent);

    fetch("/api/product", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        setProducts(data.edges || []);
        setCursor(data.pageInfo?.endCursor || null);
      })
      .finally(() => setLoading(false));
  }, [integrationId, query, sort, cursor, paginationEvent]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const toggleSelect = (id: string) => {
    setSelectedProducts((prev) => {
      const updated = new Set(prev);
      updated.has(id) ? updated.delete(id) : updated.add(id);
      return updated;
    });
  };

  const connectSelected = () => {
    const formData = new FormData();
    formData.append("action", "connect-from-shopify");
    selectedProducts.forEach((id) => formData.append("productGid", id));
    formData.append("IntegrationId", integrationId);

    fetch("/api/product", {
      method: "POST",
      body: formData,
    }).then(() => {
      setSelectedProducts(new Set());
    });
  };

  return (
    <div className="space-y-4 p-4 border rounded-md">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Search products"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
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
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline">Sort by</Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 space-y-1">
              {sortOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={option.value === sort ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => {
                    setSort(option.value);
                    setPopoverOpen(false);
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </PopoverContent>
          </Popover>
        </div>

        <Button onClick={connectSelected} disabled={selectedProducts.size === 0}>
          Connect products
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-10">Loading...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell>
                <Checkbox
                  checked={selectedProducts.size === products.length}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedProducts(new Set(products.map((p) => p.node.id)));
                    } else {
                      setSelectedProducts(new Set());
                    }
                  }}
                />
              </TableCell>
              <TableCell>Image</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Vendor</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map(({ node }) => (
              <TableRow key={node.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedProducts.has(node.id)}
                    onCheckedChange={() => toggleSelect(node.id)}
                  />
                </TableCell>
                <TableCell>
                  {node.featuredMedia?.preview?.image?.url ? (
                    <img
                      src={node.featuredMedia.preview.image.url}
                      alt={node.featuredMedia.alt || node.title}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>{node.title}</TableCell>
                <TableCell>{node.vendor}</TableCell>
                <TableCell>
                  <Badge variant="outline">{node.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
