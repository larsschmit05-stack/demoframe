'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const navItems = [
  { href: '/dashboard/demos', label: 'Demos' },
  { href: '/dashboard/billing', label: 'Billing' },
  { href: '/dashboard/account', label: 'Account' },
];

export default function SidebarNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <>
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-gray-200 font-medium text-gray-900'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-200 pt-4 mt-4">
        <p className="truncate px-3 text-xs text-gray-500">{userEmail}</p>
        <button
          onClick={handleSignOut}
          className="mt-2 block w-full rounded-md px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-100 transition-colors"
        >
          Sign out
        </button>
      </div>
    </>
  );
}
