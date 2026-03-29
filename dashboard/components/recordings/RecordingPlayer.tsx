'use client';

/**
 * @deprecated Legacy component. Recordings have been replaced by Demos.
 * This stub prevents build errors from pages that still reference RecordingPlayer.
 */
export default function RecordingPlayer({
  signedUrl: _signedUrl,
}: {
  signedUrl: string;
}) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-16">
      <div className="text-center">
        <p className="text-sm text-gray-500">
          This recording format is no longer supported.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Please re-capture this demo using the updated extension.
        </p>
      </div>
    </div>
  );
}
