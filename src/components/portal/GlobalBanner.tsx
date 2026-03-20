interface GlobalBannerProps {
  message: string;
}

export default function GlobalBanner({ message }: GlobalBannerProps) {
  return (
    <div className="flex-shrink-0 w-full bg-amber-500 text-white" role="status" aria-label="Site notification">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-2.5 flex items-center justify-center gap-2">
        <svg
          aria-hidden="true"
          focusable="false"
          className="w-4 h-4 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
          />
        </svg>
        <p className="text-sm font-medium text-center leading-snug">{message}</p>
      </div>
    </div>
  );
}
