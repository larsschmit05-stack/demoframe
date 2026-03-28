const variants = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  free: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700',
} as const;

export default function Badge({
  variant,
  children,
}: {
  variant: keyof typeof variants;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variants[variant]}`}
    >
      {children}
    </span>
  );
}
