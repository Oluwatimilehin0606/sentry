import { ChevronDown, Download, LogOut, Monitor, Moon, Sun, UserRound } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { signOut, useSession } from '@/lib/auth-client';
import { useInstall } from '@/lib/install';
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
  const install = useInstall();
  const [iphoneSteps, setIphoneSteps] = useState(false);

  if (!data) return null;
  const { name, email } = data.user;

  return (
    <>
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
          <DropdownMenuItem asChild>
            <Link to="/account">
              <UserRound aria-hidden="true" />
              Account
            </Link>
          </DropdownMenuItem>
          {/* Only when this browser can install Sentry and it isn't installed already. */}
          {install.way && (
            <DropdownMenuItem
              className="font-semibold text-primary focus:text-primary"
              onSelect={() =>
                install.way === 'prompt' ? void install.prompt() : setIphoneSteps(true)
              }
            >
              <Download className="text-primary" aria-hidden="true" />
              Install the Sentry app
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
            Theme
          </DropdownMenuLabel>
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

      {/* iPhone and iPad: Safari has no install box, so these are the steps. */}
      <Dialog open={iphoneSteps} onOpenChange={setIphoneSteps}>
        <DialogContent>
          <DialogTitle>Install Sentry on your iPhone</DialogTitle>
          <DialogDescription asChild>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[0.9375rem] text-foreground">
              <li>
                Tap the <strong className="font-semibold">Share</strong> button in Safari.
              </li>
              <li>
                Choose <strong className="font-semibold">Add to Home Screen</strong>.
              </li>
              <li>
                Tap <strong className="font-semibold">Add</strong>.
              </li>
            </ol>
          </DialogDescription>
          <DialogClose asChild>
            <Button variant="outline" className="self-start">
              Got it
            </Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </>
  );
}
