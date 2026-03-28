'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import type { Recording } from '@/lib/types';

export default function DeleteRecordingDialog({
  recording,
  open,
  onClose,
}: {
  recording: Recording;
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/recordings/${recording.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onClose();
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      title="Delete recording"
      message={`Are you sure you want to delete "${recording.name}"? This action cannot be undone.`}
      confirmLabel="Delete"
      onConfirm={handleDelete}
      onCancel={onClose}
      loading={loading}
      destructive
    />
  );
}
