// collection.server.ts
import { db } from "./db.server";
import type { Collection, CollectionIntegration } from "@prisma/client";

export async function getCollections({
  userId,
  integrationId,
  search,
  skip = 0,
  take = 50,
}: {
  userId: string;
  integrationId: string;
  search?: string;
  skip?: number;
  take?: number;
}): Promise<Collection[]> {
  return db.collection.findMany({
    where: {
      integrations: {
        some: {
          integration: {
            id: integrationId,
            userId,
          },
        },
      },
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { handle: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    skip,
    take,
    orderBy: { updatedAt: "desc" },
  });
}

export async function getCollectionById(id: string, userId: string): Promise<Collection | null> {
  return db.collection.findFirst({
    where: {
      id,
      integrations: {
        some: {
          integration: {
            userId,
          },
        },
      },
    },
  });
}

export async function createOrUpdateCollection(data: {
  userId: string;
  integrationId: string;
  title: string;
  handle: string;
  updatedAt: Date;
}): Promise<Collection> {
  const integration = await db.integration.findFirst({
    where: { id: data.integrationId, userId: data.userId },
  });
  if (!integration) throw new Error("Unauthorized or integration not found");

  const existing = await db.collection.findFirst({
    where: {
      title: data.title,
      handle: data.handle,
    },
  });

  let collection: Collection;

  if (existing) {
    collection = await db.collection.update({
      where: { id: existing.id },
      data: { updatedAt: data.updatedAt },
    });
  } else {
    collection = await db.collection.create({
      data: {
        title: data.title,
        handle: data.handle,
        updatedAt: data.updatedAt,
      },
    });
  }

  // Ensure relation exists
  await db.collectionIntegration.upsert({
    where: {
      collectionId_integrationId: {
        collectionId: collection.id,
        integrationId: data.integrationId,
      },
    },
    create: {
      collectionId: collection.id,
      integrationId: data.integrationId,
    },
    update: {},
  });

  return collection;
}

export async function deleteCollection(id: string, userId: string): Promise<void> {
  const existing = await db.collection.findFirst({
    where: {
      id,
      integrations: {
        some: {
          integration: {
            userId,
          },
        },
      },
    },
  });
  if (!existing) throw new Error("Unauthorized or collection not found");

  await db.collection.delete({ where: { id } });
}

export async function bulkUpsertCollections(
  userId: string,
  integrationId: string,
  items: {
    title: string;
    handle: string;
    updatedAt: Date;
  }[]
): Promise<void> {
  for (const item of items) {
    await createOrUpdateCollection({ userId, integrationId, ...item });
  }
}

export async function fetchCollectionsFromShopifyAPI(shopDomain: string, accessTokenDashboard: string) {
    const res = await fetch(`${process.env.SHOPIFY_APP_URL}/api/collections`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessTokenDashboard}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
  
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Shopify API error: ${res.status} - ${err}`);
    }
  
    const { collections } = await res.json();
    return collections;
  }

export async function syncCollectionsFromRemote({
    integrationId,
    userId,
  }: {
    integrationId: string;
    userId: string;
  }) {
    const integration = await db.integration.findFirst({
      where: {
        id: integrationId,
        userId,
      },
    });

    console.log(integration)
  
    if (!integration || !integration.shopDomain || !integration.accessToken) {
      throw new Error("Invalid integration or missing credentials");
    }
  
    const collections = await fetchCollectionsFromShopifyAPI(
      integration.shopDomain,
      integration.accessToken
    );
  
    // адаптація формату
    const mapped = collections.map((col: any) => ({
      title: col.title,
      handle: col.handle,
      updatedAt: new Date(col.updatedAt),
    }));
  
    await bulkUpsertCollections(userId, integrationId, mapped);
  
    return mapped.length;
  }