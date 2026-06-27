export function SkeletonListingMgmtCard() {
  return (
    <div className="flex animate-pulse items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
      <div className="space-y-2">
        <div className="h-4 w-36 rounded bg-gray-200" />
        <div className="h-3 w-48 rounded bg-gray-200" />
      </div>
      <div className="flex gap-2">
        <div className="h-7 w-16 rounded-lg bg-gray-200" />
        <div className="h-7 w-12 rounded-lg bg-gray-200" />
        <div className="h-7 w-12 rounded-lg bg-gray-200" />
      </div>
    </div>
  );
}

// Skeleton for landlord browsing tenant profiles (items-start, with tags row)
export function SkeletonProfileCard() {
  return (
    <div className="flex animate-pulse items-start justify-between rounded-xl border border-gray-200 bg-white p-5">
      <div className="space-y-2">
        <div className="h-4 w-28 rounded bg-gray-200" />
        <div className="h-3 w-44 rounded bg-gray-200" />
        <div className="flex gap-1">
          <div className="h-5 w-12 rounded-full bg-gray-200" />
          <div className="h-5 w-12 rounded-full bg-gray-200" />
        </div>
      </div>
      <div className="h-7 w-16 rounded-lg bg-gray-200" />
    </div>
  );
}

// Skeleton for tenant managing their own profiles (items-center, two action buttons)
export function SkeletonMyProfileCard() {
  return (
    <div className="flex animate-pulse items-center justify-between rounded-xl border border-gray-200 bg-white p-5">
      <div className="space-y-2">
        <div className="h-4 w-28 rounded bg-gray-200" />
        <div className="h-3 w-44 rounded bg-gray-200" />
      </div>
      <div className="flex gap-2">
        <div className="h-7 w-16 rounded-lg bg-gray-200" />
        <div className="h-7 w-12 rounded-lg bg-gray-200" />
      </div>
    </div>
  );
}

export function SkeletonListingCard() {
  return (
    <div className="flex animate-pulse gap-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className="h-[132px] w-44 flex-shrink-0 rounded-lg bg-gray-200" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-5 w-32 rounded bg-gray-200" />
        <div className="h-4 w-24 rounded bg-gray-200" />
        <div className="h-4 w-48 rounded bg-gray-200" />
        <div className="flex gap-1">
          <div className="h-5 w-14 rounded-full bg-gray-200" />
          <div className="h-5 w-14 rounded-full bg-gray-200" />
        </div>
      </div>
    </div>
  );
}
