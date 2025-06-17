import { useEffect } from "react";

type Props = {
  configUrl: string;
  disabled?: boolean; // за замовчуванням false
};

export default function LandbotLazyLivechat({ configUrl, disabled = false }: Props) {
  useEffect(() => {
    if (disabled || typeof window === "undefined") return;

    const initLandbot = () => {
      if ((window as any)._landbotLoaded) return;

      const script = document.createElement("script");
      script.type = "module";
      script.async = true;

      script.onload = () => {
        // @ts-ignore
        new window.Landbot.Livechat({ configUrl });
        (window as any)._landbotLoaded = true;
      };

      script.src = "https://cdn.landbot.io/landbot-3/landbot-3.0.0.mjs";
      document.head.appendChild(script);
    };

    window.addEventListener("mouseover", initLandbot, { once: true });
    window.addEventListener("touchstart", initLandbot, { once: true });

    return () => {
      window.removeEventListener("mouseover", initLandbot);
      window.removeEventListener("touchstart", initLandbot);
    };
  }, [configUrl, disabled]);

  return null;
}
