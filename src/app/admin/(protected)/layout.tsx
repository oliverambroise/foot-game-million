import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAdmin } from "@/lib/admin-auth";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const isManager = admin.role === "MANAGER";
  const isSuperAdmin = admin.role === "SUPER_ADMIN";

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold">⚽ Admin — Défi Football</span>
        <nav className="flex flex-wrap gap-4 text-sm text-gray-300">
          <Link href="/admin" className="hover:text-white">
            Dashboard
          </Link>
          <Link href="/admin/joueurs" className="hover:text-white">
            Joueurs
          </Link>
          <Link href="/admin/codes" className="hover:text-white">
            Codes
          </Link>
          {!isManager && (
            <Link href="/admin/niveaux" className="hover:text-white">
              Niveaux
            </Link>
          )}
          {!isManager && (
            <Link href="/admin/parametres" className="hover:text-white">
              Paramètres
            </Link>
          )}
          {isSuperAdmin && (
            <Link href="/admin/administrateurs" className="hover:text-white">
              Administrateurs
            </Link>
          )}
          <Link href="/admin/compte" className="hover:text-white">
            Mon compte
          </Link>
          <form action="/api/admin/auth/logout" method="POST">
            <button className="text-red-400 hover:text-red-300">Déconnexion</button>
          </form>
        </nav>
      </header>
      <main className="p-4 max-w-5xl mx-auto">{children}</main>
    </div>
  );
}
