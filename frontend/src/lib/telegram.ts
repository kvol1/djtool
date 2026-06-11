import * as telegramSdkReact from "@telegram-apps/sdk-react";

type TelegramWindow = Window & {
  Telegram?: {
    WebApp?: {
      initData?: string;
      ready?: () => void;
      expand?: () => void;
      HapticFeedback?: {
        impactOccurred?: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
        notificationOccurred?: (type: "error" | "success" | "warning") => void;
      };
    };
  };
};

export function getInitData() {
  try {
    const retrieveLaunchParams = (telegramSdkReact as { retrieveLaunchParams?: () => { initDataRaw?: string } })
      .retrieveLaunchParams;
    const initDataRaw = retrieveLaunchParams?.().initDataRaw;
    if (initDataRaw) return initDataRaw;
  } catch {
    // Telegram launch params are unavailable in a regular browser tab.
  }

  return (window as TelegramWindow).Telegram?.WebApp?.initData ?? "";
}

export function initTelegramShell() {
  const webApp = (window as TelegramWindow).Telegram?.WebApp;
  webApp?.ready?.();
  webApp?.expand?.();
}

export function hapticSuccess() {
  (window as TelegramWindow).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
}

export function hapticTap() {
  (window as TelegramWindow).Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
}
