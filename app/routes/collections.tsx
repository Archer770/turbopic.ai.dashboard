// routes/collections.tsx
import { useLoaderData } from "@remix-run/react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useState, useEffect, useCallback } from "react";
import { db } from "~/utils/db.server";
import { requireUser } from "~/utils/requireUser";
import { AppSidebar } from "~/components/app-sidebar";
import { SiteHeader } from "~/components/site-header";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Table, TableHeader, TableRow, TableCell, TableBody } from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "~/components/ui/select";
import { Pagination } from "~/components/ui/pagination";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { Checkbox } from "~/components/ui/checkbox";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const integrations = await db.integration.findMany({
    where: { userId: user.id },
    select: { id: true, shopDomain: true },
  });
  return { user, integrations };
}

export default function CollectionsPage() {

    const data = useLoaderData<{ user: { name?: string; email: string; avatar: string; avatarf: string }, token:string }>();
    data.user.avatarf = '..';
  
      
  const { integrations } = useLoaderData<typeof loader>();
  const [collections, setCollections] = useState<any[]>([]);
  const [integrationId, setIntegrationId] = useState<string>(integrations[0]?.id || "");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [maxPage, setMaxPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [popupIntegration, setPopupIntegration] = useState<string>("");
  const [popupSearch, setPopupSearch] = useState<string>("");
  const [popupCollections, setPopupCollections] = useState<any[]>([]);
  const [popupSelected, setPopupSelected] = useState<Set<string>>(new Set());

  const fetchCollections = useCallback(() => {
    if (!integrationId) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("action", "get-collections");
    formData.append("integrationId", integrationId);
    fetch("/api/collections", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        setCollections(data.collections || []);
        setMaxPage(1); // поки без пагінації
      })
      .finally(() => setLoading(false));
  }, [integrationId]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const openPopup = () => {
    setPopupIntegration(integrations[0]?.id || "");
    setPopupSearch("");
    setPopupSelected(new Set());
    setPopupCollections([]);
  };

  const synsCollections = () => {
    if (!integrationId) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("action", "sync-remote");
    formData.append("integrationId", integrationId);
    fetch("/api/collections", {
      method: "POST",
      body: formData,
    })
      .then(() => {
        fetchCollections();
      });
  };

  const fetchPopupCollections = () => {
    if (!popupIntegration) return;
    fetch("https://turbopicstaging.loclx.io/api/collections", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ handles: [], integrationId: popupIntegration }),
    })
      .then((res) => res.json())
      .then((data) => {
        setPopupCollections(data.collections || []);
      });
  };

  const togglePopupSelection = (id: string) => {
    setPopupSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="[--header-height:calc(theme(spacing.14))]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <AppSidebar user={data.user} />
          <SidebarInset>
            <div className="flex flex-col gap-4 p-4">
              <Card className="p-4 space-y-4">
                <div className="flex flex-wrap gap-4 items-center">
                  {/* <Input
                    placeholder="Search collections"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="max-w-sm"
                  /> */}
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
                  <Button onClick={() => fetchCollections()}>Reload</Button>
                  <Button onClick={() => synsCollections()}>Syns</Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" onClick={openPopup}>
                        Add Collections
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <div className="space-y-4">
                        <Select value={popupIntegration} onValueChange={setPopupIntegration}>
                          <SelectTrigger>
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
                        <div className="flex gap-2">
                          <Input
                            placeholder="Search remote collections"
                            value={popupSearch}
                            onChange={(e) => setPopupSearch(e.target.value)}
                          />
                          <Button onClick={fetchPopupCollections}>Search</Button>
                        </div>
                        <div className="max-h-96 overflow-auto border rounded p-2 space-y-1">
                          {popupCollections
                            .filter((col) =>
                              col.title.toLowerCase().includes(popupSearch.toLowerCase())
                            )
                            .map((col) => (
                              <div
                                key={col.id}
                                className="flex items-center gap-2 border-b py-1"
                              >
                                <Checkbox
                                  checked={popupSelected.has(col.id)}
                                  onCheckedChange={() => togglePopupSelection(col.id)}
                                />
                                <div>
                                  <div className="font-medium">{col.title}</div>
                                  <div className="text-xs text-muted-foreground">{col.handle}</div>
                                </div>
                              </div>
                            ))}
                        </div>
                        <div className="text-right pt-2">
                          <Button disabled={popupSelected.size === 0}>Import Selected</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {loading ? (
                  <div className="text-center text-muted-foreground py-12">Loading...</div>
                ) : collections.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">No collections found.</div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableCell>Title</TableCell>
                          <TableCell>Handle</TableCell>
                          <TableCell>Updated</TableCell>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {collections.map((col) => (
                          <TableRow key={col.id}>
                            <TableCell>{col.title}</TableCell>
                            <TableCell>{col.handle}</TableCell>
                            <TableCell>{new Date(col.updatedAt).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {/* <Pagination
                      page={page}
                      maxPage={maxPage}
                      onPageChange={(newPage) => setPage(newPage)}
                    /> */}
                  </>
                )}
              </Card>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
