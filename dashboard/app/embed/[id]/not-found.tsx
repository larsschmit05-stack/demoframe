import Link from 'next/link';

export default function EmbedNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Demo not available
      </h1>
      <p className="text-gray-500 mb-6 max-w-md">
        This demo may have been deactivated or deleted by its creator.
      </p>
      <Link
        href="/"
        className="inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
      >
        Create your own interactive demo
      </Link>
    </main>
  );
}
