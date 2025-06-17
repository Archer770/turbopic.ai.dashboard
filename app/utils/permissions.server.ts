import db from "./db.server.js";
type PermissionSet = Record<string, string>;
export async function getEffectivePermissions(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      permissions: true,
      subscriptions: {
        where: { status: "paid" },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          plan: { include: { permissions: true } }
        }
      }
    }
    
  });

  

  const result: PermissionSet = {};

  const planPerms = user?.subscriptions[0]?.plan?.permissions ?? [];
  for (const p of planPerms) {
    const [prefix] = p.key.split(":", 2);
    result[prefix] = p.key;
  }

  const userPerms = user?.permissions ?? [];
  for (const p of userPerms) {
    const [prefix] = p.key.split(":", 2);
    result[prefix] = p.key;
  }

  return result;
  
}

export async function hasPermission(userId: string, key: string, options?: { minValue?: number; exactValue?: string }) {
  const permissions = await getEffectivePermissions(userId);

  const key_arr =  key.split(":");

  const value = permissions[key_arr[0]];

  if (!value) return false;



  const parts = value.split(":");
  const permissionValue = parts[2];

  if (options?.exactValue !== undefined) {
    return permissionValue === options.exactValue;
  }

  if (options?.minValue !== undefined) {
    const num = parseInt(permissionValue);
    return !isNaN(num) && num >= options.minValue;
  }

  return true;
}

export async function getPermissionValue(userId: string, key: string): Promise<string | null> {
  const permissions = await getEffectivePermissions(userId);
  const raw = permissions[key];
  if (!raw) return null;

  const parts = raw.split(":");
  return parts[2] ?? null;
}