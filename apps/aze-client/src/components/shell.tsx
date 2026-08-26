import Image from 'next/image';
import Link from 'next/link';
import { ReactNode } from 'react';

/**
 * The chrome every page sits inside, so a page added later looks like it
 * belongs by existing — the same bargain `src/middleware.ts` makes about being
 * protected by existing.
 *
 * Platform: it holds nothing from the Demo, so deleting the catalogue leaves it
 * untouched. It is also a server component and must stay one — theming here is
 * a media query, not state, so nothing in this tree needs the browser.
 *
 * The wordmark is a link rather than a heading deliberately: every page keeps
 * exactly one `<h1>`, its own.
 */
export function Shell({
  action,
  children,
}: {
  /** Rendered at the end of the header. `/login` passes nothing. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <header className="border-b border-border bg-raised">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-3">
          {/* The backing is white rather than a token because the logo is an
              opaque PNG with white baked in: against the dark surface it would
              otherwise read as a leak. Sized and rounded so it reads as a chip
              instead — and it disappears into the light header, which is white
              anyway. Swap it for a token when the logo gains transparency. */}
          <Link href="/" className="inline-flex rounded-md bg-white p-1.5">
            <Image src="/assets/aze-logo.png" alt="Aze" width={88} height={44} priority />
          </Link>
          {action}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </>
  );
}
