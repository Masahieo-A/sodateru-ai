import Image from "next/image";

export function SotaAvatar({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`relative inline-block overflow-hidden rounded-full border border-amber-200 bg-amber-50 shrink-0 ${className}`} style={{ width: size, height: size }}>
      <Image
        src="/sota.png"
        alt="ソウタ"
        width={Math.round(size * 1.8)}
        height={Math.round(size * 2.4)}
        unoptimized
        className="absolute max-w-none h-auto w-[180%] left-[-40%] top-[-20%]"
      />
    </span>
  );
}
