
import { db } from "./db.server";
import { Prisma } from "@prisma/client";

export async function GetListProducts({
  userid,
  countperpage = "20",
  page = "0",
  query,
  sort = "updatedAt desc",
}: {
  userid: string;
  countperpage?: string;
  page?: string;
  query?: string | null;
  sort?: string;
}) {
  const take = parseInt(countperpage);
  const skip = parseInt(page) * take;

  const where: Prisma.GeneratedProductWhereInput = query
    ? {
      userId: userid,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { vendor: { contains: query, mode: "insensitive" } },
        ],
      }
    : {userId: userid};

    const sortFieldMap: Record<string, keyof Prisma.GeneratedProductOrderByWithRelationInput> = {
        "updated_at": "updatedAt",
        "created_at": "createdAt",
        "title": "title",
        "vendor": "vendor",
      };
      
    const [sortFieldRaw, sortDirectionRaw] = sort.split(" ");
    const sortField = sortFieldMap[sortFieldRaw] || "updatedAt";
    const sortDirection = sortDirectionRaw === "asc" ? "asc" : "desc";
    
    const orderBy: Prisma.GeneratedProductOrderByWithRelationInput = {
    [sortField]: sortDirection,
    };

  const [data, total] = await Promise.all([
    db.generatedProduct.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        images: true,
      },
    }),
    db.generatedProduct.count({ where }),
  ]);

  const maxpages = Math.ceil(total / take);

  return { data, maxpages };
}
