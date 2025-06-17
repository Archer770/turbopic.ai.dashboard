// settings.server.ts - server-side logic for saving settings via Prisma
import { db } from "./db.server";
import { hasPermission, getEffectivePermissions } from "./permissions.server.js"

export async function saveGenerationRules(userId: string, data: {
  generationMode?: string;
  messageTitle?: string;
  messageTags?: string;
  messageSeoTitle?: string;
  messageSeoDes?: string;
}) {

  const permissions = await getEffectivePermissions(userId);

  if(permissions.settings == 'settings:fields:true'){
      return db.setting.upsert({
          where: { userId },
          update: { ...data },
          create: {
            userId,
            ...data
          }
        });
    }else{
      false;
    }
}

export async function saveDefaultDescriptionSettings(userId: string, data: {
  maxDesLength?: number;
  minDesLength?: number;
  maxDesLengthSimple?: number;
  minDesLengthSimple?: number;
  messageDes?: string;
}) {

  const permissions = await getEffectivePermissions(userId);

  if(permissions.settings == 'settings:fields:true'){

  return db.setting.upsert({
    where: { userId },
    update: { ...data },
    create: {
      userId,
      ...data
    }
  });

  }else{
      false;
    }
}

export async function saveLocaleSettings(userId: string, data: {
  locale: string;
  localeDefault: boolean;
}) {

  const permissions = await getEffectivePermissions(userId);

  if(permissions.language = 'language:change:true'){

  return db.setting.upsert({
    where: { userId },
    update: {
      locale: data.locale,
      localeDefault: data.localeDefault
    },
    create: {
      userId,
      locale: data.locale,
      localeDefault: data.localeDefault
    }
  });

  }else{
      false;
    }
}

export async function saveConditions(userId: string, conditions: any[]) {
  const result = [];

  const permissions = await getEffectivePermissions(userId);

  if(permissions.settings == 'settings:fields:true'){

  for (const condition of conditions) {
    if (!condition.title) continue;
    let title = condition.title;
    let index = 1;

    while (
      await db.conditionGPT.findFirst({
        where: {
          userId,
          title,
          NOT: condition.id !== 'new' ? { id: condition.id } : undefined
        }
      })
    ) {
      index++;
      title = `${condition.title} (${index})`;
    }

    condition.title = title;

    if (condition.id === 'new') {
      result.push(
        await db.conditionGPT.create({
          data: {
            userId,
            title: condition.title,
            message: condition.message
          }
        })
      );
    } else {
      result.push(
        await db.conditionGPT.update({
          where: { id: condition.id },
          data: {
            title: condition.title,
            message: condition.message
          }
        })
      );
    }
  }

  return db.conditionGPT.findMany({ where: { userId } });

  }else{
      false;
    }
}

export async function saveDescriptions(userId: string, descriptions: any[]) {

  const permissions = await getEffectivePermissions(userId);

  if(permissions.settings = 'settings:fields:true'){

  const result = [];

  for (const desc of descriptions) {
    if (!desc.title) continue;
    let title = desc.title;
    let index = 1;

    while (
      await db.descriptionGen.findFirst({
        where: {
          userId,
          title,
          NOT: desc.id !== 'new' ? { id: desc.id } : undefined
        }
      })
    ) {
      index++;
      title = `${desc.title} (${index})`;
    }

    desc.title = title;

    if (desc.id === 'new') {
      result.push(
        await db.descriptionGen.create({
          data: {
            userId,
            title: desc.title,
            message: desc.message,
            maxTextLength: desc.maxTextLength,
            minTextLength: desc.minTextLength,
            maxTextLengthSimple: desc.maxTextLengthSimple,
            minTextLengthSimple: desc.minTextLengthSimple
          }
        })
      );
    } else {
      result.push(
        await db.descriptionGen.update({
          where: { id: desc.id },
          data: {
            title: desc.title,
            message: desc.message,
            maxTextLength: desc.maxTextLength,
            minTextLength: desc.minTextLength,
            maxTextLengthSimple: desc.maxTextLengthSimple,
            minTextLengthSimple: desc.minTextLengthSimple
          }
        })
      );
    }
  }

  return db.descriptionGen.findMany({ where: { userId } });

  }else{
      false;
    }
}

export async function getSettingsPayload(userId: string) {
    return db.setting.findUnique({ where: { userId } });
  }
  
  export async function getConditions(userId: string) {
    return db.conditionGPT.findMany({ where: { userId } });
  }
  
  export async function getDescriptions(userId: string) {
    return db.descriptionGen.findMany({ where: { userId } });
  }