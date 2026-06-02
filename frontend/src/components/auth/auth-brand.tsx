import Image from "next/image";

export function AuthBrand() {
  return (
    <div className="flex items-center justify-center">
      <Image
        src="/flashlogo.png"
        alt="FlashGo"
        width={170}
        height={68}
        className="h-12 w-auto object-contain sm:h-14"
        priority
      />
    </div>
  );
}
