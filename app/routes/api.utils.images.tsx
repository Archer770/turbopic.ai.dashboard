import { type ActionFunction } from "@remix-run/node"
import { addImagesByForm } from "~/utils/image-upload.server"
import {
  getUserBySessionToken,
  authenticateBasic,
  getUserByIntegrationToken,
} from "~/utils/auth.server"

export const action: ActionFunction = async ({ request }) => {
  const headers = request.headers
  const formData = await request.formData()
  const files = formData.getAll("images") as File[]

  let userId: string | null = null
  let productId = formData.get("productId")?.toString()

  // 1. Auth via Session-Token
  const sessionToken = headers.get("Session-Token")
  if (sessionToken) {
    const user = await getUserBySessionToken(sessionToken)
    if (user) userId = user.id
  }

  // 2. Auth via Basic Auth
  const basicAuth = headers.get("Authorization")?.match(/^Basic (.+)$/)
  if (basicAuth) {
    const [email, password] = atob(basicAuth[1]).split(":")
    const user = await authenticateBasic(email, password)
    if (user) userId = user.id
  }

  // 3. Auth via Bearer token (Integration)
  const bearer = headers.get("Authorization")?.match(/^Bearer (.+)$/)
  if (bearer) {
    const user = await getUserByIntegrationToken(bearer[1])
    if (user) userId = user.id
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (files.length === 0) {
    return new Response(JSON.stringify({ error: "No files uploaded" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const result = await addImagesByForm({imagesFile: files, productId, userId })

  return new Response(JSON.stringify({ success: true, images: result }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}
