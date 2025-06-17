import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Toaster, toast } from "react-hot-toast";
import { useLoaderData } from "@remix-run/react";
import { getEffectivePermissions } from "./utils/permissions.server"
import "./tailwind.css";
import { requireUser } from "./utils/requireUser";

interface LoaderData {
    permissions: {};
  }

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  const [permissions] = await Promise.all([
      getEffectivePermissions(user.id),
    ]);

  return new Response(JSON.stringify({ permissions }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }); 
}

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];


import LandbotLazyLivechat from "~/components/custom/LandbotWidget";

export function Layout({ children }: { children: React.ReactNode }) {

const {
      permissions
    } = useLoaderData<LoaderData>();

const disabled_landobot_view = Boolean(!Boolean(permissions.landobot) || permissions?.landobot != 'landobot:view:true');

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <LandbotLazyLivechat configUrl="https://storage.googleapis.com/landbot.pro/v3/H-2985637-AAP0NGM6EO6BZ0MM/index.json" disabled={disabled_landobot_view} />

      <div>
        <Toaster 
        position="top-right"
        
        toastOptions={{
          style: {
            padding: '16px 24px',
          },
          duration: 5000,
          removeDelay: 1000,
          success: {
            duration: 4000,
            removeDelay: 1000,
            iconTheme: {
              primary: 'green',
              secondary: 'white',
            },
          },
        }}
        />
      </div>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
