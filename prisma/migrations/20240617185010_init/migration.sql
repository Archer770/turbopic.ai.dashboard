-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('day', 'week', 'month', 'year');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "googleId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'credentials',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "oneTimeTokens" INTEGER NOT NULL DEFAULT 0,
    "stripeCustomerId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "metadata" JSONB,
    "shopDomain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedProduct" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "vendor" TEXT,
    "description" TEXT,
    "type" TEXT,
    "tags" TEXT[],
    "price" DOUBLE PRECISION,
    "comparePrice" DOUBLE PRECISION,
    "sku" TEXT,
    "barcode" TEXT,
    "weight" DOUBLE PRECISION,
    "weightUnit" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "conditionId" TEXT,
    "conditionCustomGpt" TEXT,
    "cronJob" TEXT,

    CONSTRAINT "GeneratedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "jsonValue" TEXT,
    "productId" TEXT,
    "tokensUsed" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "amountCents" INTEGER NOT NULL,
    "tokens" INTEGER NOT NULL,
    "interval" "BillingInterval" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "stripePriceId" TEXT NOT NULL,
    "stripeProductId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maxProductUnitsPerMonth" DOUBLE PRECISION,
    "visible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "remainingProductUnits" DOUBLE PRECISION,
    "remainingTokens" INTEGER NOT NULL DEFAULT 0,
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "oneTimeProductId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OneTimeProduct" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "amountCents" INTEGER NOT NULL,
    "tokens" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "stripeProductId" TEXT NOT NULL,
    "stripePriceId" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OneTimeProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OneTimeOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    "stripePaymentIntentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OneTimeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConditionGPT" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConditionGPT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DescriptionGen" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "message" TEXT,
    "maxTextLength" INTEGER,
    "minTextLength" INTEGER,
    "maxTextLengthSimple" INTEGER,
    "minTextLengthSimple" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DescriptionGen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "generationMode" TEXT,
    "messageTitle" TEXT,
    "messageTags" TEXT,
    "messageSeoTitle" TEXT,
    "messageSeoDes" TEXT,
    "messageDes" TEXT,
    "maxDesLength" INTEGER,
    "minDesLength" INTEGER,
    "maxDesLengthSimple" INTEGER,
    "minDesLengthSimple" INTEGER,
    "locale" TEXT,
    "localeDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "productId" TEXT,
    "logGenId" TEXT,
    "integrationId" TEXT,
    "key" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionIntegration" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,

    CONSTRAINT "CollectionIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProductImages" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProductImages_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_LogImages" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_LogImages_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CollectionProducts" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CollectionProducts_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_UserPermissions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UserPermissions_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_PlanPermissions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PlanPermissions_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_oneTimeTokens_idx" ON "User"("oneTimeTokens");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_createdAt_idx" ON "Session"("createdAt");

-- CreateIndex
CREATE INDEX "Integration_accessToken_idx" ON "Integration"("accessToken");

-- CreateIndex
CREATE INDEX "Integration_refreshToken_idx" ON "Integration"("refreshToken");

-- CreateIndex
CREATE INDEX "Integration_createdAt_idx" ON "Integration"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_userId_shopDomain_key" ON "Integration"("userId", "shopDomain");

-- CreateIndex
CREATE INDEX "GeneratedProduct_barcode_idx" ON "GeneratedProduct"("barcode");

-- CreateIndex
CREATE INDEX "GeneratedProduct_status_idx" ON "GeneratedProduct"("status");

-- CreateIndex
CREATE INDEX "GeneratedProduct_createdAt_idx" ON "GeneratedProduct"("createdAt");

-- CreateIndex
CREATE INDEX "GenerationLog_tokensUsed_idx" ON "GenerationLog"("tokensUsed");

-- CreateIndex
CREATE INDEX "GenerationLog_createdAt_idx" ON "GenerationLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_stripePriceId_key" ON "SubscriptionPlan"("stripePriceId");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_tokens_idx" ON "SubscriptionPlan"("tokens");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_createdAt_idx" ON "SubscriptionPlan"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_remainingTokens_idx" ON "Subscription"("remainingTokens");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_createdAt_idx" ON "Subscription"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_invoiceId_key" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OneTimeProduct_stripePriceId_key" ON "OneTimeProduct"("stripePriceId");

-- CreateIndex
CREATE INDEX "OneTimeProduct_tokens_idx" ON "OneTimeProduct"("tokens");

-- CreateIndex
CREATE INDEX "OneTimeProduct_createdAt_idx" ON "OneTimeProduct"("createdAt");

-- CreateIndex
CREATE INDEX "OneTimeOrder_tokens_idx" ON "OneTimeOrder"("tokens");

-- CreateIndex
CREATE INDEX "OneTimeOrder_status_idx" ON "OneTimeOrder"("status");

-- CreateIndex
CREATE INDEX "OneTimeOrder_createdAt_idx" ON "OneTimeOrder"("createdAt");

-- CreateIndex
CREATE INDEX "Image_createdAt_idx" ON "Image"("createdAt");

-- CreateIndex
CREATE INDEX "ConditionGPT_createdAt_idx" ON "ConditionGPT"("createdAt");

-- CreateIndex
CREATE INDEX "DescriptionGen_createdAt_idx" ON "DescriptionGen"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_userId_key" ON "Setting"("userId");

-- CreateIndex
CREATE INDEX "Setting_createdAt_idx" ON "Setting"("createdAt");

-- CreateIndex
CREATE INDEX "TokenUsage_tokensUsed_idx" ON "TokenUsage"("tokensUsed");

-- CreateIndex
CREATE INDEX "ProductUsage_userId_idx" ON "ProductUsage"("userId");

-- CreateIndex
CREATE INDEX "ProductUsage_integrationId_idx" ON "ProductUsage"("integrationId");

-- CreateIndex
CREATE INDEX "ProductUsage_usedAt_idx" ON "ProductUsage"("usedAt");

-- CreateIndex
CREATE INDEX "ProductUsage_key_idx" ON "ProductUsage"("key");

-- CreateIndex
CREATE INDEX "ProductUsage_productId_idx" ON "ProductUsage"("productId");

-- CreateIndex
CREATE INDEX "ProductUsage_logGenId_idx" ON "ProductUsage"("logGenId");

-- CreateIndex
CREATE INDEX "ProductUsage_subscriptionId_idx" ON "ProductUsage"("subscriptionId");

-- CreateIndex
CREATE INDEX "ProductUsage_createdAt_idx" ON "ProductUsage"("createdAt");

-- CreateIndex
CREATE INDEX "Collection_handle_idx" ON "Collection"("handle");

-- CreateIndex
CREATE INDEX "Collection_createdAt_idx" ON "Collection"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_title_handle_key" ON "Collection"("title", "handle");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionIntegration_collectionId_integrationId_key" ON "CollectionIntegration"("collectionId", "integrationId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "_ProductImages_B_index" ON "_ProductImages"("B");

-- CreateIndex
CREATE INDEX "_LogImages_B_index" ON "_LogImages"("B");

-- CreateIndex
CREATE INDEX "_CollectionProducts_B_index" ON "_CollectionProducts"("B");

-- CreateIndex
CREATE INDEX "_UserPermissions_B_index" ON "_UserPermissions"("B");

-- CreateIndex
CREATE INDEX "_PlanPermissions_B_index" ON "_PlanPermissions"("B");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedProduct" ADD CONSTRAINT "GeneratedProduct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedProduct" ADD CONSTRAINT "GeneratedProduct_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "ConditionGPT"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationLog" ADD CONSTRAINT "GenerationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationLog" ADD CONSTRAINT "GenerationLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "GeneratedProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneTimeOrder" ADD CONSTRAINT "OneTimeOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneTimeOrder" ADD CONSTRAINT "OneTimeOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "OneTimeProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConditionGPT" ADD CONSTRAINT "ConditionGPT_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DescriptionGen" ADD CONSTRAINT "DescriptionGen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenUsage" ADD CONSTRAINT "TokenUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUsage" ADD CONSTRAINT "ProductUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUsage" ADD CONSTRAINT "ProductUsage_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUsage" ADD CONSTRAINT "ProductUsage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "GeneratedProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUsage" ADD CONSTRAINT "ProductUsage_logGenId_fkey" FOREIGN KEY ("logGenId") REFERENCES "GenerationLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUsage" ADD CONSTRAINT "ProductUsage_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionIntegration" ADD CONSTRAINT "CollectionIntegration_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionIntegration" ADD CONSTRAINT "CollectionIntegration_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductImages" ADD CONSTRAINT "_ProductImages_A_fkey" FOREIGN KEY ("A") REFERENCES "GeneratedProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductImages" ADD CONSTRAINT "_ProductImages_B_fkey" FOREIGN KEY ("B") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LogImages" ADD CONSTRAINT "_LogImages_A_fkey" FOREIGN KEY ("A") REFERENCES "GenerationLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LogImages" ADD CONSTRAINT "_LogImages_B_fkey" FOREIGN KEY ("B") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CollectionProducts" ADD CONSTRAINT "_CollectionProducts_A_fkey" FOREIGN KEY ("A") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CollectionProducts" ADD CONSTRAINT "_CollectionProducts_B_fkey" FOREIGN KEY ("B") REFERENCES "GeneratedProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserPermissions" ADD CONSTRAINT "_UserPermissions_A_fkey" FOREIGN KEY ("A") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserPermissions" ADD CONSTRAINT "_UserPermissions_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlanPermissions" ADD CONSTRAINT "_PlanPermissions_A_fkey" FOREIGN KEY ("A") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlanPermissions" ADD CONSTRAINT "_PlanPermissions_B_fkey" FOREIGN KEY ("B") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

