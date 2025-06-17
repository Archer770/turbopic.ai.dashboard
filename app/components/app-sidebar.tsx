import * as React from "react"
import {
  BookOpen,
  Bot,
  Command,
  Frame,
  LifeBuoy,
  Map,
  PieChart,
  Send,
  Settings2,
  ShoppingBag,
  LayoutDashboard,
  SquareTerminal,
} from "lucide-react"

import { NavMain } from "~/components/nav-main"
import { NavUser } from "~/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar"

type User = {
  name?: string
  email: string
  avatar: string
  avatarf: string
}

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user: User
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {

  const data = {
    user,
    navMain: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        title: "Subscriptions",
        url: "/subscriptions",
        icon: LayoutDashboard,
      },
      {
        title: "Add Product",
        url: "/add-product",
        icon: LayoutDashboard,
      },
      {
        title: "Products",
        url: "/products",
        icon: ShoppingBag,
      },
      {
        title: "Collections",
        url: "/collections",
        icon: ShoppingBag,
      },
      {
        title: "Settings",
        url: "/settings",
        icon: Settings2,
      },
      {
        title: "Logs",
        url: "/logs",
        icon: Settings2,
      },
    ],
    
  }

  return (
    <Sidebar
      className="top-[--header-height] !h-[calc(100svh-var(--header-height))]"
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Command className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Turbopic</span>
                  <span className="truncate text-xs">Enterprise</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
