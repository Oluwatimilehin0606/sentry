import { ChevronDown, FileText, Globe, House, LogOut, Monitor, Moon, Sun, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOut, useSession } from '@/lib/auth-client';
import { applyTheme, getThemeChoice, type ThemeChoice } from '@/lib/theme';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

/** Signed-in account menu: who you are, account page, theme, sign out. */
export function AccountMenu() {
  const { data } = useSession();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<ThemeChoice>(getThemeChoice);

  if (!data) return null;
  const { name, email } = data.user;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex cursor-pointer items-center gap-2.5 rounded-full border bg-card py-1 pr-3 pl-1 text-[0.9375rem] font-semibold transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none">
        <span className="grid size-8 place-items-center rounded-full bg-[#0e2342] text-[0.8125rem] font-bold text-white">
          {initials(name)}
        </span>
        <span className="hidden max-w-[12ch] truncate sm:inline">{name.split(' ')[0]}</span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate font-semibold">{name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* On phones the header has no room for the app menu, so its links live here. */}
        <DropdownMenuItem asChild className="md:hidden">
          <Link to="/home">
            <House aria-hidden="true" />
            Home
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="md:hidden">
          <Link to="/websites">
            <Globe aria-hidden="true" />
            Websites
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="md:hidden">
          <Link to="/reports">
            <FileText aria-hidden="true" />
            Reports
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/account">
            <UserRound aria-hidden="true" />
            Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => {
            const choice = value as ThemeChoice;
            setTheme(choice);
            applyTheme(choice);
          }}
        >
          <DropdownMenuRadioItem value="system">
            <Monitor aria-hidden="true" />
            System
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <Sun aria-hidden="true" />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon aria-hidden="true" />
            Dark
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            // Leave the protected page first; otherwise it sees the session end and sends us to sign-in.
            navigate('/', { replace: true, state: { signedOut: true } });
            await signOut();
          }}
        >
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
