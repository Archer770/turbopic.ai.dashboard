import { redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useNavigate, useLoaderData} from "@remix-run/react";
import { sessionStorage } from "~/utils/session.server";
import { useEffect, useState, useRef, useCallback } from "react"
import type { GeneratedProduct } from "@prisma/client";

import { AppSidebar } from "~/components/app-sidebar"
import { SiteHeader } from "~/components/site-header"
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Textarea } from "~/components/ui/textarea"
import { Card } from "~/components/ui/card"
import { Badge } from "~/components/ui/badge";

import { requireUser } from "~/utils/requireUser";
import { db } from "~/utils/db.server";
import { toast } from "react-hot-toast"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "~/components/ui/select";

import { MediaGrid } from "~/components/custom/media-grid"
import { MultiSelectTags } from "~/components/custom/MultiSelectTags"
import { MultiSelectCombobox } from "~/components/custom/MultiSelectCombobox"
import { SingleSelectCombobox } from "~/components/custom/SingleSelectCombobox"

import { getEffectivePermissions } from "~/utils/permissions.server";
import { getUserProductUsageThisMonth } from "~/utils/analytic.server";

// типізація Loader

interface LoaderData {
  user: any;
  token: string | null;
  product: GeneratedProduct;
  tags: string[];
  collections: object[];
  conditions: object[];
  permissions: {};
  productUsedLimit: {};
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const cookie = request.headers.get("Cookie");
  const session = await sessionStorage.getSession(cookie);
  const token = session.get("token");

  const productId = params.productid;
  if (!productId) {
    throw new Response("Product ID is required", { status: 400 });
  }

  const product = await db.generatedProduct.findUnique({
    where: { id: productId, userId: user.id },
    include: { images: true, collections: true },
  });

  if (!product) {
    throw new Response("Product not found", { status: 404 });
  }

  const tags = await db.generatedProduct.findMany({
    where: { userId: user.id },
    select: { tags: true },
    distinct: ["tags"],
  });

  const types = await db.generatedProduct.findMany({
    where: { userId: user.id },
    select: { type: true },
    //distinct: ["type"],
  });

  const vendors = await db.generatedProduct.findMany({
    where: { userId: user.id },
    select: { vendor: true },
    //distinct: ["vendor"],
  });

  const collections = await db.collection.findMany({
  where: {
    integrations: {
      some: {
        integration: {
          userId: user.id
        }
      }
    }
  }
});

const allVendors = [...new Set(vendors.flatMap((p) => p.vendor || []))];
const allTypes = [...new Set(types.flatMap((p) => p.type || []))];


  const allTags = [...new Set(tags.flatMap((p) => p.tags || []))];
  const allCollections = collections.map((c) => ({
    label: c.title,
    value: c.id,
  }));

const conditions = await db.conditionGPT.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" }
  });

const permissions = await getEffectivePermissions(user.id);

const productUsedLimit = await getUserProductUsageThisMonth(user.id);

  return new Response(
    JSON.stringify({ user, token, product, tags: allTags, collections: allCollections, types:allTypes, vendors: allVendors, conditions, permissions, productUsedLimit }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const cookie = request.headers.get("Cookie");
  const session = await sessionStorage.getSession(cookie);
  const token = session.get("token");

  if (token) {
    await db.session.delete({ where: { token } });
  }

  return redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}

function ProductDetail() {
  const navigate = useNavigate();
  const data = useLoaderData<LoaderData>();

  const [product, setProduct] = useState(data.product);
  const [title, setTitle] = useState(product.title || "");
  const [description, setDescription] = useState(product.description || "");
  const [seoTitle, setSeoTitle] = useState(product.seoTitle || "");
  const [seoDescription, setSeoDescription] = useState(product.seoDescription || "");
  const [price, setPrice] = useState(product.price?.toString() || "");
  const [comparePrice, setComparePrice] = useState(product.comparePrice?.toString() || "");
  const [sku, setSku] = useState(product.sku || "");
  const [barcode, setBarcode] = useState(product.barcode || "");
  const [weight, setWeight] = useState(product.weight?.toString() || "");
  const [weightUnit, setWeightUnit] = useState(product.weightUnit || "GRAMS");
  const [vendor, setVendor] = useState(product.vendor || "");
  const [type, setType] = useState(product.type || "");
  const [tags, setTags] = useState(product.tags || []);
  const [collections, setCollections] = useState(product.collections || []);
  const [images, setImages] = useState(product.images || []);
  const [conditionSelectGpt, setConditionSelectGpt] = useState(
  product.conditionId ? product.conditionId : product.conditionCustomGpt ? "custom" : ""
  );

  const [conditionCustomGpt, setCondition_gpt] = useState(
    product.conditionCustomGpt || ""
  );

  const[productUsedLimit, setProductUsedLimit ] = useState(data.productUsedLimit);


  const [saveData, setSaveData] = useState<Record<string, any>>({});
  const [isDisabled, setIsDisabled] = useState(false);

  const disabled_seo = Boolean(!Boolean(data.permissions.generation) || data.permissions?.generation != 'generation:seo:true');
  const disabled_settings_fields = Boolean(!Boolean(data.permissions.settings) || data.permissions?.settings != 'settings:fields:true');

  const productId = product.id;
  const [isPolling, setIsPolling] = useState(false);
  const [pollInterval, setPollInterval] = useState(5000);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

   const fetchProductDetail = useCallback(async () => {
    const formData = new FormData();
    formData.append("action", "get");
    formData.append("id", productId.toString());
    try {
      const res = await fetch("/api/product", { method: "POST", body: formData });
      const data = await res.json();
      if (data) setProduct(data);
    } catch (e) {
      console.error(e);
    }
  }, [productId]);

  useEffect(() => {
  if (!isPolling) return;
  const tick = async () => {
    if(product.cronJob == 'pending'){
      await fetchProductDetail();
    }

    const elapsed = Date.now() - startTimeRef.current;
    if (elapsed < 60000) {
      
      pollRef.current = setTimeout(tick, pollInterval);
      setPollInterval((pi) => Math.min(pi + 5000, 60000));
      
    } else {
      setIsPolling(false);
      setPollInterval(5000);
      toast.success("Updates completed");
    }
  };
  tick();
  return () => {
    if (pollRef.current) clearTimeout(pollRef.current);
  };
}, [isPolling, fetchProductDetail]);



  useEffect(() => {
    setTitle(product.title || "");
    setDescription(product.description || "");
    setPrice(product.price?.toString() || "");
    setComparePrice(product.comparePrice?.toString() || "");
    setSku(product.sku || "");
    setBarcode(product.barcode || "");
    setWeight(product.weight?.toString() || "");
    setWeightUnit(product.weightUnit || "GRAMS");
    setVendor(product.vendor || "");
    setType(product.type || "");
    setTags(product.tags || []);
    setCollections(product.collections || []);
    setImages(product.images || []);
    setConditionSelectGpt(
    product.conditionId ? product.conditionId : product.conditionCustomGpt ? "custom" : ""
   
  );
   setIsDisabled(product.cronJob == 'pending');
  setCondition_gpt(product.conditionCustomGpt || "");
  }, [product]);

  const conditions_gpt_options = [
  ...data.conditions.map((cond) => ({
    value: cond.id,
    label: cond.title || "Untitled"
  })),
  { value: "custom", label: "Custom rule" }
];



  const conditions_gpt_message = () => {
    if (!conditionSelectGpt || conditionSelectGpt === "custom") return "";

    const selected = data.conditions.find(
      (cond) => cond.id === conditionSelectGpt
    );

    return selected?.message || "";
  };

  useEffect(() => {
    const updated: Record<string, any> = {};
    if (title !== product.title) updated["title"] = title;
    if (description !== product.description) updated["description"] = description;
    if (price !== (product.price?.toString() || "")) updated["price"] = price;
    if (comparePrice !== (product.comparePrice?.toString() || "")) updated["comparePrice"] = comparePrice;
    if (sku !== product.sku) updated["sku"] = sku;
    if (barcode !== product.barcode) updated["barcode"] = barcode;
    if (weight !== (product.weight?.toString() || "")) updated["weight"] = weight;
    if (weightUnit !== product.weightUnit) updated["weightUnit"] = weightUnit;
    if (vendor !== product.vendor) updated["vendor"] = vendor;
    if (type !== product.type) updated["type"] = type;
    if (JSON.stringify(tags) !== JSON.stringify(product.tags)) updated["tags"] = tags;
    if (JSON.stringify(collections) !== JSON.stringify(product.collections)) updated["collections"] = collections;
    if (JSON.stringify(images) !== JSON.stringify(product.images)) updated["images"] = images;
    if (conditionSelectGpt === "custom") {
      updated["conditionCustomGpt"] = conditionCustomGpt;
      updated["conditionId"] = null;
    } else if (conditionSelectGpt && conditionSelectGpt !== product.conditionId) {
      updated["conditionId"] = conditionSelectGpt;
      updated["conditionCustomGpt"] = null;
    }
    setSaveData(updated);
  }, [title, description, price, comparePrice, sku, barcode, weight, weightUnit, vendor, type, tags, collections, images, conditionSelectGpt, conditionCustomGpt, product]);

  const handleGenerate = (fields: string[]) => {
    const formData = new FormData();
    formData.append("action", "generate");
    formData.append("id", product.id);
    fields.forEach((field) => formData.append("fields", field));
    setIsDisabled(true);
    fetch("/api/generation", {
      method: "POST",
      body: formData,
    }).then(response => response.json())
    .then((result) => {
      toast.success("Generation task added");
      result.cronJob = 'pending';
      setProduct(result);
      setIsDisabled(false);
      startTimeRef.current = Date.now();
      setPollInterval(5000);
      setIsPolling(true);
      setIsDisabled(false);
    });
  };

  const handleConditionSelectGpt = (value: string) => {
    setConditionSelectGpt(value);
  };

  const handleSave = () => {
    const formData = new FormData();
    formData.append("action", "save");
    formData.append("id", product.id);
    for (const [key, val] of Object.entries(saveData)) {
    if (val === undefined) continue;

    if (Array.isArray(val)) {
      // Масив (наприклад, images, collections тощо)
      for (const item of val) {
        if (item?.file) {
          formData.append(key, item.file);
        } else {
          formData.append(key, JSON.stringify(item));
        }
      }
    } else if (typeof val === "object" && val !== null) {
      // Звичайний об'єкт
      formData.append(key, JSON.stringify(val));
    } else {
      // Примітиви: string, number, boolean
      formData.append(key, String(val));
    }
  }




    fetch("/api/product", {
      method: "POST",
      body: formData,
    }).then(() => toast.success("Saved"));
  };

 

  return (


    
    <div className="container py-6 space-y-6">
      <Card className="p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold">
            {title || `Product #${product.id}`}
          </h1>
          <div className="flex gap-2">
          <Button onClick={()=>handleGenerate([])} disabled={Boolean(productUsedLimit.available) && productUsedLimit.available < 1}>
            Generate
          </Button>
          <Button disabled={isDisabled || Object.keys(saveData).length === 0} onClick={handleSave}>
            Save
          </Button>
          </div>
        </div>

        <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
          {/* Left section */}
          <div className="w-full xl:w-2/3 space-y-6">
            <Card className="p-4 space-y-4">
            <label className="block text-sm font-medium">Title</label>
            <div className="flex gap-2">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={isDisabled} />
              <Button variant="outline" onClick={() => handleGenerate(["title"])} disabled={isDisabled  || (Boolean(productUsedLimit.available) && productUsedLimit.available < 0.1)}>
                AI
              </Button>
            </div>

            <label className="block text-sm font-medium">Description</label>
            <div className="flex gap-2">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                disabled={isDisabled}
              />
              <Button variant="outline" onClick={() => handleGenerate(["description"])} disabled={isDisabled  || (Boolean(productUsedLimit.available) && productUsedLimit.available < 0.1)}>
                AI
              </Button>
            </div>
            </Card>

            <Card className="p-4 space-y-4">
            <label className="block text-sm font-medium">Media</label>
            <MediaGrid
              disabled={isDisabled}
              imageUrls={images}
              onChange={(value) => setImages(value)}
            />
            </Card>

            <Card className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Price"
                disabled={isDisabled}
              />
              <Input
                value={comparePrice}
                onChange={(e) => setComparePrice(e.target.value)}
                placeholder="Compare-at price"
                disabled={isDisabled}
              />
            </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="SKU"
                  disabled={isDisabled}
                />
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Barcode"
                  disabled={isDisabled}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
              <Input
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="Weight"
                disabled={isDisabled}
              />
              <SingleSelectCombobox
                options={["GRAMS", "KILOGRAMS", "OUNCES", "POUNDS"]}
                value={weightUnit}
                onChange={setWeightUnit}
                disabled={isDisabled}
              />
            </div>
            </Card>

            <Card className="p-4 space-y-4">
            <label className="block text-sm font-medium">Seo-Title</label>
            <div className="flex gap-2">
              <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} disabled={isDisabled || disabled_seo} />
              <Button variant="outline" onClick={() => handleGenerate(["seo-title"])} disabled={isDisabled || disabled_seo || (Boolean(productUsedLimit.available) && productUsedLimit.available < 0.1)}>
                AI
              </Button>
            </div>

            <label className="block text-sm font-medium">Seo-Description</label>
            <div className="flex gap-2">
              <Textarea
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                rows={6}
                disabled={isDisabled || disabled_seo}
              />
              <Button variant="outline" onClick={() => handleGenerate(["seo-description"])} disabled={isDisabled || disabled_seo || (Boolean(productUsedLimit.available) && productUsedLimit.available < 0.1)}>
                AI
              </Button>
            </div>
            </Card>
          </div>

          {/* Right sidebar */}
          <div className="w-full xl:w-1/3 space-y-6">
            <Card className="p-4 space-y-4">
              {/* Status */}
              <Badge variant="outline">{product.status}</Badge>
            </Card>

            <Card className="p-4 space-y-4">
            <div className="space-y-4">

            <SingleSelectCombobox
              options={data.types || []}
              value={type}
              onChange={setType}
              disabled={isDisabled}
              placeholder="Select type"
              title="Product Type"
            />

            <SingleSelectCombobox
              options={data.vendors || []}
              value={vendor}
              onChange={setVendor}
              disabled={isDisabled}
              placeholder="Select vendor"
              title="Vendor"
            />

            <MultiSelectTags
              options={data.tags}
              values={tags}
              onChange={setTags}
              disabled={isDisabled}
              placeholder="Add tags"
            />

            <MultiSelectCombobox
              options={data.collections}
              value={collections.map((c)=>c.id)}
              onChange={setCollections}
              disabled={isDisabled}
              placeholder="Add collections"
              title="Collections"
            />
            </div>
            </Card>

             
            
            <Card className="p-4 space-y-4">
              
                <div className="space-y-2">
                  <label className="block text-sm font-medium" htmlFor="condition-gpt">Additional condition for GPT</label>
                  <Select
                    disabled={isDisabled || disabled_settings_fields}
                    onValueChange={handleConditionSelectGpt}
                    value={conditionSelectGpt}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a condition" />
                    </SelectTrigger>
                    <SelectContent>
                      {conditions_gpt_options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium" htmlFor="condition-message">Custom message</label>
                  <Textarea
                    id="condition-message"
                    disabled={isDisabled || disabled_settings_fields}
                    value={
                      conditionSelectGpt === "custom"
                        ? conditionCustomGpt
                        : conditions_gpt_message() || ""
                    }
                    readOnly={conditionSelectGpt !== "custom"}
                    onChange={(e) => setCondition_gpt(e.target.value)}
                    maxLength={150}
                    rows={6}
                  />
                </div>
              
            </Card>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function ProductPage() {
  const data = useLoaderData<{ user: { name?: string; email: string; avatar: string; avatarf: string }, token: string }>();
  data.user.avatarf = "..";

  return (
    <div className="[--header-height:calc(theme(spacing.14))]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <AppSidebar user={data.user} />
          <SidebarInset>
            <div className="flex flex-1 flex-col gap-4 p-4">
              <ProductDetail />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
