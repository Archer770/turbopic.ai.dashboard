// routes/api/shopify-sync/collections.ts
import type { ActionFunctionArgs } from "@remix-run/node";
import {
  bulkUpsertCollections,
  getCollections,
  createOrUpdateCollection,
  deleteCollection,
  syncCollectionsFromRemote
} from "~/utils/collections.server";
import { requireUser } from "~/utils/requireUser";

export const action = async ({ request }: ActionFunctionArgs) => {
    let user;
    try {
      user = await requireUser(request);
    } catch {
      return new Response("Unauthorized", { status: 401 });
    }
  
    try {
      const contentType = request.headers.get("Content-Type");
      let action: string | null = null;
      let integrationId: string | undefined;
      let collection: any;
      let collections: any;
      let collectionId: string | undefined;
  
      if (contentType?.includes("application/json")) {
        const body = await request.json();
        action = body.action;
        integrationId = body.integrationId;
        collections = body.collections;
        collection = body.collection;
        collectionId = body.collectionId;
      } else if (contentType?.includes("form")) {
        const formData = await request.formData();
        action = formData.get("action")?.toString() || null;
        integrationId = formData.get("integrationId")?.toString();
        collectionId = formData.get("collectionId")?.toString();
        const title = formData.get("title")?.toString();
        const handle = formData.get("handle")?.toString();
        collection = title && handle ? { title, handle } : undefined;
      }
  
      if (action === "sync-collections") {
        if (!integrationId || !Array.isArray(collections)) {
          return new Response(JSON.stringify({ error: "Invalid payload" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        await bulkUpsertCollections(user.id, integrationId, collections);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (action === "sync-remote") {
        if (!integrationId) {
          return new Response(JSON.stringify({ error: "Missing integrationId" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      
        try {
          const count = await syncCollectionsFromRemote({ userId: user.id, integrationId });
          return new Response(JSON.stringify({ success: true, synced: count }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          console.error("[sync-remote error]", e);
          return new Response(JSON.stringify({ error: e.message || "Sync failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
  
      if (action === "add-collection") {
        if (!integrationId || !collection) {
          return new Response(JSON.stringify({ error: "Missing collection data" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        await createOrUpdateCollection({
          userId: user.id,
          integrationId,
          title: collection.title,
          handle: collection.handle,
          updatedAt: new Date(),
        });
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (action === "update-collection") {
        if (!collectionId || !collection) {
          return new Response(JSON.stringify({ error: "Missing collectionId or data" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        await createOrUpdateCollection({
          userId: user.id,
          integrationId: integrationId || "", // still required for upsert
          title: collection.title,
          handle: collection.handle,
          updatedAt: new Date(),
        });
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
  
      if (action === "delete-collection") {
        if (!collectionId) {
          return new Response(JSON.stringify({ error: "Missing collectionId" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        await deleteCollection(collectionId, user.id);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
  
      if (action === "get-collections") {
        const search = undefined;
        const skip = 0;
        const take = 50;
        if (!integrationId) {
          return new Response(JSON.stringify({ error: "Missing integrationId" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const data = await getCollections({
          userId: user.id,
          integrationId,
          search,
          skip,
          take,
        });
        return new Response(JSON.stringify({ collections: data }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
  
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      console.error("[collections sync error]", e);
      return new Response(JSON.stringify({ error: "Server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  };

export const loader = async ({ request }: ActionFunctionArgs) => {
  let user;
  try {
    user = await requireUser(request);
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action === "get-collections") {
  
  const integrationId = url.searchParams.get("integrationId");
  const search = url.searchParams.get("q") || undefined;
  const skip = parseInt(url.searchParams.get("skip") || "0");
  const take = parseInt(url.searchParams.get("take") || "50");

  if (!integrationId) {
    return new Response(JSON.stringify({ error: "Missing integrationId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = await getCollections({
    userId: user.id,
    integrationId,
    search,
    skip,
    take,
  });

  return new Response(JSON.stringify({ collections: data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

    }
};
