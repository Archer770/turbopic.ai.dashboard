import { redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form } from "@remix-run/react";
import { sessionStorage } from "~/utils/session.server";
import { useEffect, useState } from "react"

import { AppSidebar } from "~/components/app-sidebar"
import { SiteHeader } from "~/components/site-header"
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar"
import { Button } from "~/components/ui/button"
import { useToast } from "~/hooks/use-toast"

import { MultilineImageDrop, type MultilineValue } from "~/components/MultilineImageDrop"
import { ProductsSyncTable } from "~/components/custom/products-sync-table";

import { requireUser } from "~/utils/requireUser";
import { db } from "~/utils/db.server";
import type { Integration } from "@prisma/client"

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const cookie = request.headers.get("Cookie")
  const session = await sessionStorage.getSession(cookie)
  const token = session.get("token")

  let user_db = await db.user.findFirst({
    where: {
     id: user.id,
    },
    include:{
      integrations: true
    }
  })

  console.log("📦 [dashboard.loader] Loaded user:", user);
  return new Response(JSON.stringify({ user: user_db, token }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
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

export const DropBlockImages = ({ userToken }: { userToken: string }) => {
  const [images, setImages] = useState<MultilineValue>({})

  useEffect(()=>{
    console.log(images);
  }, [images])

  const [uploading, setUploading] = useState(false)

  const { toast } = useToast()

const handleUpload = async () => {
  if (Object.keys(images).length === 0) {
    toast({
      title: "No images selected",
      description: "Please add at least one image group.",
      variant: "destructive",
    })
    return
  }

  setUploading(true)

  const uploadPromises = Object.entries(images).map(([groupKey, group]) => {
    const formData = new FormData()
    group.files.forEach((fileObj) => {
      formData.append("images", fileObj.file)
    })

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("POST", "/api/utils/images", true)
      xhr.setRequestHeader("Session-Token", userToken)
      xhr.setRequestHeader("Accept", "application/json")

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          setImages((prev) => ({
            ...prev,
            [groupKey]: {
              ...prev[groupKey],
              progress,
            },
          }))
        }
      }

      xhr.onload = () => {
        if (xhr.status === 200) {
          toast({
            title: "Uploaded successfully",
            description: `Group "${groupKey}" uploaded.`,
          })

          setImages((prev) => {
            const copy = { ...prev }
            delete copy[groupKey]
            return copy
          })

          resolve(xhr.response)
        } else {
          toast({
            title: "Upload failed",
            description: `Group "${groupKey}" failed to upload.`,
            variant: "destructive",
          })
          reject(xhr.response)
        }
      }

      xhr.onerror = () => {
        toast({
          title: "Network error",
          description: `Group "${groupKey}" could not be uploaded.`,
          variant: "destructive",
        })
        reject("Network error")
      }

      xhr.send(formData)
    })
  })

  Promise.allSettled(uploadPromises).then(() => {
    setUploading(false)
    toast({
      title: "Upload finished",
      description: "All groups processed.",
    })
  })
}

  return (
    <>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Add products</h2>
        <p className="text-sm text-muted-foreground">
          Upload several images to create products. Images with the same prefixes are grouped into one product.
          <br />
          Example: <code>prefix_image-name.png</code>
        </p>
      </div>

      <div className="w-full mt-4">
        <MultilineImageDrop
          value={images}
          onChange={setImages}
          maxCount={20}
          allowMultiple
        />
      </div>

      <Button
        variant="outline"
        className="w-full mt-4"
        disabled={uploading}
        onClick={handleUpload}
      >
        {uploading ? "Uploading..." : "Submit"}
      </Button>
    </>
  )
}


export default function AddProductPage() {

  const rawData = useLoaderData<{
    user: {
      name?: string;
      email: string;
      avatar: string;
      avatarf: string;
      integrations: any[];
    };
    token: string;
  }>();

  console.log(rawData.user)
  
  const data = {
    ...rawData,
    user: {
      ...rawData.user,
      integrations: rawData.user.integrations.map((i) => ({
        ...i,
        createdAt: new Date(i.createdAt),
      })) as Integration[],
    },
  };
  
  data.user.avatarf = '..';
  return (
    <div className="[--header-height:calc(theme(spacing.14))]">
      
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <AppSidebar user={data.user} />
          <SidebarInset>
            <div className="flex flex-1 flex-col gap-4 p-4">
              <div className="grid auto-rows-min gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-muted/50 p-4" >
                  <DropBlockImages userToken={data.token} />
                </div>
                <div className="aspect-video rounded-xl bg-muted/50" />
              </div>
              <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min p-4">
                <ProductsSyncTable integrations={data.user.integrations} />
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  )
}