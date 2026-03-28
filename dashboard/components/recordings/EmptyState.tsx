export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
      <div className="text-4xl mb-4">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900">
        Get started with DemoFrame
      </h3>
      <p className="mt-1 text-sm text-gray-500 max-w-sm">
        Record interactive demos of your app and share them with a single link.
      </p>
      <ol className="mt-6 space-y-4 text-left">
        <li className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
            1
          </span>
          <div>
            <p className="text-sm font-medium text-gray-900">
              Install the Chrome Extension
            </p>
            <p className="text-xs text-gray-500">
              Click the DemoFrame icon in your toolbar to get started.
            </p>
          </div>
        </li>
        <li className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
            2
          </span>
          <div>
            <p className="text-sm font-medium text-gray-900">
              Record your first demo
            </p>
            <p className="text-xs text-gray-500">
              Visit your app, click &quot;Start Recording,&quot; interact with your
              product, then stop.
            </p>
          </div>
        </li>
        <li className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
            3
          </span>
          <div>
            <p className="text-sm font-medium text-gray-900">
              Share the link
            </p>
            <p className="text-xs text-gray-500">
              Copy the shareable link and embed it on your landing page or send
              it directly.
            </p>
          </div>
        </li>
      </ol>
    </div>
  );
}
