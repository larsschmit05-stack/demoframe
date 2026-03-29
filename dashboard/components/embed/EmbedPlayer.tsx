'use client';

/**
 * @deprecated Legacy component. Replaced by DemoPlayer.
 * This stub prevents build errors from any remaining references.
 */
export default function EmbedPlayer({
  signedUrl: _signedUrl,
  recordingId: _recordingId,
  recordingName: _recordingName,
}: {
  signedUrl: string;
  recordingId: string;
  recordingName: string;
}) {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-gray-50 p-8 text-center">
      <p className="text-gray-500">
        This recording format is no longer supported.
      </p>
      <p className="mt-1 text-xs text-gray-400">
        Please re-capture this demo using the updated extension.
      </p>
    </div>
  );
}
