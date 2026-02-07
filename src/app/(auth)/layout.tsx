import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-violet-600 to-violet-700 p-12 flex-col justify-between">
        <Link href="/" className="flex items-center gap-2">
          <img
            src="/images/evasion-logo.png"
            alt="Evasion"
            className="h-10 w-auto"
          />
        </Link>

        <div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Join the Road Community
          </h1>
          <p className="text-violet-100 text-lg">
            Connect with fellow enthusiasts, discover amazing routes,
            and experience driving like never before.
          </p>
        </div>

        <p className="text-violet-200 text-sm">
          © 2026 Evasion. Drive together, explore more.
        </p>
      </div>

      {/* Right side - Auth forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-zinc-950">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <img
              src="/images/evasion-logo.png"
              alt="Evasion"
              className="h-10 w-auto"
            />
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
