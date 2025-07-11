import { db } from "./db.server";
import { TokenUsage, Payment, GenerationLog } from "@db/client";
import dayjs from "dayjs";

type DateInput = string | Date | undefined;

const getDateRange = (from?: DateInput, to?: DateInput) => {
  const now = new Date();
  const start = from
    ? new Date(new Date(from).setHours(0, 0, 0, 0))
    : new Date(now.getFullYear(), now.getMonth(), 1);

  const end = to
    ? new Date(new Date(to).setHours(23, 59, 59, 999))
    : new Date(new Date(now.setDate(now.getDate() + 1)).setHours(23, 59, 59, 999));

  return { start, end };
};

// Logs of generations
export const getLogs = async ({
  firstDay,
  endDay,
  userId,
  take,
}: {
  firstDay?: DateInput;
  endDay?: DateInput;
  userId: string;
  take?: number;
}): Promise<GenerationLog[]> => {
  const { start, end } = getDateRange(firstDay, endDay);

  return db.generationLog.findMany({
    where: {
      userId,
      createdAt: {
        gte: start,
        lte: end,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take,
  });
};

// Tokens usage per user
export const getTokensUsage = async ({
  firstDay,
  endDay,
  userId,
}: {
  firstDay?: DateInput;
  endDay?: DateInput;
  userId: string;
}): Promise<{ UserTokens: TokenUsage[] }> => {
  try {
    const { start, end } = getDateRange(firstDay, endDay);

    const UserTokens = await db.tokenUsage.findMany({
      where: {
        userId,
        usedAt: {
          gte: start,
          lte: end,
        },
      },
      orderBy: {
        usedAt: "desc",
      },
    });

    return { UserTokens };
  } catch (e) {
    console.error("getTokensUsage error:", e);
    return { UserTokens: [] };
  }
};

export const getProductUsage = async ({
  firstDay,
  endDay,
  userId,
  shopDomain,
}: {
  firstDay?: DateInput;
  endDay?: DateInput;
  userId: string;
  shopDomain: string | null;
}): Promise<{ productUsage: TokenUsage[] }> => {
  try {
    const { start, end } = getDateRange(firstDay, endDay);

    const productUsage = await db.productUsage.findMany({
      where: {
        userId,
        usedAt: {
          gte: start,
          lte: end,
        },
      },
      include:{
        integration: true
      },
      orderBy: {
        usedAt: "desc",
      },
    });

    productUsage.map((item)=>{
      if(item.integration?.shopDomain == shopDomain){
        item.currentShop = true;
      }
    })

    return { productUsage };
  } catch (e) {
    console.error("getproductUsage error:", e);
    return { productUsage: [] };
  }
};

// Payments by user
export const getPayments = async ({
  firstDay,
  endDay,
  userId,
}: {
  firstDay?: DateInput;
  endDay?: DateInput;
  userId: string;
}): Promise<{ paymentLogs: Payment[] }> => {
  try {
    const { start, end } = getDateRange(firstDay, endDay);

    const paymentLogs = await db.payment.findMany({
      where: {
        userId,
        paidAt: {
          gte: start,
          lte: end,
        },
      },
      orderBy: {
        paidAt: "desc",
      },
    });

    return { paymentLogs };
  } catch (e) {
    console.error("getPayments error:", e);
    return { paymentLogs: [] };
  }
};

// Deduct tokens logic
export const takeAwaiTokens = async ({
  userId,
  tokens,
}: {
  userId: string;
  tokens: number;
}): Promise<boolean> => {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: {
          where:{
            status: { in: ["active", "trialing", "paid"] }
          }
        },
      },
    });

    if (!user) return false;

    let myTokens = tokens;
    const updateOps: Promise<any>[] = [];

    // Log usage
    updateOps.push(
      db.tokenUsage.create({
        data: {
          userId: user.id,
          tokensUsed: myTokens,
        },
      })
    );

    const activeSubs = user.subscriptions.filter(
      (s) => s.remainingTokens > 0
    );

    for (const sub of activeSubs) {
      if (myTokens <= 0) break;

      const available = sub.remainingTokens;
      const toDeduct = Math.min(myTokens, available);
      myTokens -= toDeduct;

      updateOps.push(
        db.subscription.update({
          where: { id: sub.id },
          data: {
            remainingTokens: available - toDeduct,
          },
        })
      );
    }

    if (myTokens > 0) {
      const newBalance = Math.max(0, user.oneTimeTokens - myTokens);
      updateOps.push(
        db.user.update({
          where: { id: user.id },
          data: {
            oneTimeTokens: newBalance,
          },
        })
      );
    }

    await Promise.all(updateOps);
    return true;
  } catch (e) {
    console.error("takeAwaiTokens error:", e);
    return false;
  }
};

export async function recordProductUsage({
  userId,
  shopDomain,
  productId,
  logGenId,
  key,
  weight = 1.0,
  subscriptionId = null
}: {
  userId: string;
  shopDomain: string | null;
  productId: string | null;
  logGenId: string | null;
  key: string;
  weight: number;
  subscriptionId: string | null;
}) {

  let Integration = null;
  if(shopDomain){
    Integration = await db.integration.findUnique({
      where:{
        userId_shopDomain: {
          userId,
          shopDomain
        }
      }
    })
  }

  const user = await db.user.findUnique({
        where: { id: userId },
        include: {
          subscriptions: {
            where:{
              status: { in: ["active", "trialing", "paid"] }
            }
          },
        },
    });
    

  if(!Boolean(subscriptionId)){
    subscriptionId = user.subscriptions[0]?.id;
  }else{
    const subscription = await db.subscription.findUnique({
        where: { id: subscriptionId }
    });

    if(subscription.remainingProductUnits <= 0){
      subscriptionId = user.subscriptions[0]?.id;
    }
  }

  let myWeight = weight;
  const updateOps: Promise<any>[] = [];

  for (const sub of user.subscriptions) {
      if (myWeight <= 0) break;

      const available = sub.remainingProductUnits;
      const toDeduct = Math.min(myWeight, available);

      myWeight -= toDeduct;

      if(myWeight <= 0){

      }

      updateOps.push(
        db.subscription.update({
          where: { id: sub.id },
          data: {
            remainingProductUnits: available - toDeduct,
          },
        })
      );
    }

  await Promise.all(updateOps);

  return await db.productUsage.create({
    data: {
      user: { connect: { id: userId } },
      ...(Integration && { integration: { connect: { id: Integration.id } } }),
      ...(productId && { product: { connect: { id: productId } } }),
      ...(logGenId && { logGen: { connect: { id: logGenId } } }),
      key,
      weight,
      ...(subscriptionId && { subscription: { connect: { id: subscriptionId } } }),
      usedAt: new Date()
    }
  });
}

export async function getUserProductUsageThisMonth(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const result = await db.productUsage.aggregate({
    _sum: {
      weight: true
    },
    where: {
      userId,
      usedAt: {
        gte: startOfMonth,
        lte: endOfMonth
      }
    }
  });
  
  const monthlyProductUnits = await db.subscription.aggregate({
    _sum: {
      remainingProductUnits: true
    },
    where: {
      userId,
      status: { in: ["active", "trialing", "paid"] }
    }
  });



  return {
    usage: result._sum.weight ?? 0,
    available: monthlyProductUnits._sum.remainingProductUnits ?? ( (3 - result._sum.weight > 0) ? (3 - result._sum.weight) : 0 )
  };
};

export async function logGenAction(
    userId: string,
    action: string,
    jsonValue: unknown,
    tokensUsed: number,
    durationMs: number,
    productId: string,
    imageIds: string[] = [], // Array of existing Image IDs
    productUsageId = null
  ): Promise<GenerationLog> {
    const safeJson = JSON.stringify(jsonValue, (key, value) =>
      typeof value === "bigint" ? Number(value) : value
    );
  
    return db.generationLog.create({
      data: {
        userId,
        action,
        jsonValue: safeJson,
        tokensUsed,
        durationMs,
        productId,
        images: {
          connect: imageIds.map((id) => ({ id })),
        },
        productUsages: {
          connect: {
            id: productUsageId
          }
        }
      },
      include: {
        images: true,
      },
    });
  }


export const addPaymentLog = async ({
    userId,
    amountCents,
    currency,
    status,
    invoiceId,
    subscriptionId,
    oneTimeProductId,
    paidAt,
    provider
  }: {
    userId: string;
    amountCents: number;
    currency: string;
    status: string;
    invoiceId: string;
    subscriptionId?: string;
    oneTimeProductId?: string;
    paidAt?: Date;
    provider?: string;
  }): Promise<Payment | void> => {
    try {
      return await db.payment.upsert({
        where: { invoiceId },
        update: { status, paidAt: paidAt ?? new Date() },
        create: {
          userId,
          amountCents,
          currency,
          status,
          provider,
          invoiceId,
          subscriptionId: subscriptionId || null,
          oneTimeProductId: oneTimeProductId || null,
          paidAt: paidAt ?? new Date(),
        },
      });
    } catch (e) {
      console.error("addPaymentLog error:", e);
    }
  };

  export const getTokenDistribution = async ({ userId }: { userId: string }) => {
    const [used, activeSubs, user] = await Promise.all([
      db.tokenUsage.aggregate({
        _sum: {
          tokensUsed: true,
        },
        where: {
          userId,
          usedAt: {
            gte: new Date(dayjs().startOf("month").toISOString()),
            lte: new Date(dayjs().endOf("month").toISOString()),
          },
        },
      }),
      db.subscription.findMany({
        where: {
          userId,
          status: { in: ["active", "trialing", "paid"] },
        },
        select: {
          remainingTokens: true,
        },
      }),
      db.user.findUnique({
        where: { id: userId },
        select: { oneTimeTokens: true },
      }),
    ]);
  
    return {
      usedTokens: used._sum.tokensUsed || 0,
      subscriptionTokens: activeSubs.reduce((acc, sub) => acc + sub.remainingTokens, 0),
      oneTimeTokens: user?.oneTimeTokens || 0,
    };
  };