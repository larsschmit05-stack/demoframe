export default function DemosEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
      </svg>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">
        Create your first demo
      </h3>
      <p className="mt-1 text-sm text-gray-500 max-w-sm">
        Capture interactive snapshots of your app and let visitors click through a pixel-perfect copy.
      </p>
      <ol className="mt-6 space-y-4 text-left">
        <li className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
            1
          </span>
          <div>
            <p className="text-sm font-medium text-gray-900">
              Install the Chrome Extension
            </p>
            <p className="text-xs text-gray-500">
              Click the DemoFrame icon in your toolbar.
            </p>
          </div>
        </li>
        <li className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
            2
          </span>
          <div>
            <p className="text-sm font-medium text-gray-900">
              Capture screens
            </p>
            <p className="text-xs text-gray-500">
              Visit your app, click &quot;Capture This Screen&quot; on each page you want to include, then &quot;Finish &amp; Upload.&quot;
            </p>
          </div>
        </li>
        <li className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
            3
          </span>
          <div>
            <p className="text-sm font-medium text-gray-900">
              Wire navigation &amp; embed
            </p>
            <p className="text-xs text-gray-500">
              Link screens together so visitors can click between pages, then embed on your site.
            </p>
          </div>
        </li>
      </ol>
    </div>
  );
}
