export default function AuthLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-white to-gray-100 dark:from-gray-900 dark:to-gray-950 p-4 sm:p-6">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    );
  }