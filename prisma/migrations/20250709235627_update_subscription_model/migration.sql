/*
  Warnings:

  - A unique constraint covering the columns `[shopifyPurchaseGid]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[shopifySubscriptionGid]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[shopifyPlanHandle]` on the table `SubscriptionPlan` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `provider` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `provider` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('STRIPE', 'SHOPIFY');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "provider" "BillingProvider" NOT NULL,
ADD COLUMN     "shopifyPurchaseGid" TEXT,
ADD COLUMN     "shopifyShopGid" TEXT,
ALTER COLUMN "invoiceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "provider" "BillingProvider" NOT NULL,
ADD COLUMN     "shopifyShopGid" TEXT,
ADD COLUMN     "shopifySubscriptionGid" TEXT,
ALTER COLUMN "stripeCustomerId" DROP NOT NULL,
ALTER COLUMN "stripeSubscriptionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SubscriptionPlan" ADD COLUMN     "shopifyPlanHandle" TEXT,
ALTER COLUMN "stripePriceId" DROP NOT NULL,
ALTER COLUMN "stripeProductId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_shopifyPurchaseGid_key" ON "Payment"("shopifyPurchaseGid");

-- CreateIndex
CREATE INDEX "Payment_provider_idx" ON "Payment"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_shopifySubscriptionGid_key" ON "Subscription"("shopifySubscriptionGid");

-- CreateIndex
CREATE INDEX "Subscription_provider_idx" ON "Subscription"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_shopifyPlanHandle_key" ON "SubscriptionPlan"("shopifyPlanHandle");
