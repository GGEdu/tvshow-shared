/**
 * Shared application layout — accepts consumer-specific nav components
 * as props since DesktopNav/BottomNav differ between apps (different menu
 * entries, branding, etc.).
 *
 * Usage:
 *   import { Layout } from "@ggedu/tvshow-ui";
 *   import DesktopNav from "./components/DesktopNav.jsx";
 *   import BottomNav from "./components/BottomNav.jsx";
 *
 *   <Layout desktopNav={<DesktopNav />} bottomNav={<BottomNav />}>
 *     {children}
 *   </Layout>
 */
export default function Layout({ children, desktopNav, bottomNav }) {
  return (
    <div className="min-h-screen bg-surface-base text-text-primary">
      {desktopNav}
      <main className="mx-auto max-w-7xl px-4 pt-4 pb-24 md:px-6 md:pt-6 md:pb-8">
        {children}
      </main>
      {bottomNav}
    </div>
  );
}
