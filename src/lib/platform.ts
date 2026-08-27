export type Platform = 'windows' | 'android' | 'ios' | 'macos' | 'linux';
export type Locale = 'ru' | 'en';

export type InstallerHashes = {
  macos: string;
  linux: string;
};

export type InstallAction =
  | { kind: 'download' | 'guide'; label: string; href: string }
  | { kind: 'command'; label: string; command: string };

export function detectPlatform(userAgent: string): Platform | null {
  const normalized = userAgent.toLowerCase();

  if (normalized.includes('android')) return 'android';
  if (normalized.includes('iphone') || normalized.includes('ipad')) return 'ios';
  if (normalized.includes('windows')) return 'windows';
  if (normalized.includes('macintosh') || normalized.includes('mac os x')) return 'macos';
  if (normalized.includes('linux') || normalized.includes('x11')) return 'linux';

  return null;
}

export function getInstallAction(
  platform: Platform,
  locale: Locale,
  hashes: InstallerHashes
): InstallAction {
  const labels = locale === 'ru'
    ? {
        install: 'Установить',
        command: 'Скопировать команду установки',
        profile: 'Установить профиль',
        android: 'Начать установку'
      }
    : {
        install: 'Install',
        command: 'Copy installation command',
        profile: 'Install profile',
        android: 'Start installation'
      };

  if (platform === 'windows') {
    return { kind: 'download', label: labels.install, href: '/downloads/install-windows.cmd' };
  }

  if (platform === 'ios') {
    return {
      kind: 'download',
      label: labels.profile,
      href: '/downloads/profile/russiantrusted.mobileconfig'
    };
  }

  if (platform === 'android') {
    return { kind: 'guide', label: labels.android, href: '/install/android/' };
  }

  const url = `https://rusinternet.com/downloads/install-${platform}.sh`;
  const hash = hashes[platform].toLowerCase();
  const digestCommand = platform === 'macos'
    ? `shasum -a 256 "$tmp" | awk '{print $1}'`
    : `sha256sum "$tmp" | awk '{print $1}'`;
  const messages = locale === 'ru'
    ? {
        download: 'Ошибка: не удалось скачать установщик.',
        mismatch: 'Ошибка: контрольная сумма установщика не совпадает. Установка прервана.'
      }
    : {
        download: 'Error: could not download the installer.',
        mismatch: 'Error: installer checksum does not match. Installation aborted.'
      };
  // Runs inside a subshell so a failed check can `exit` without closing the
  // user's terminal, the EXIT trap and temp vars stay contained, and both
  // failure paths print an explicit reason instead of silently doing nothing.
  const command = `(tmp="$(mktemp)" && trap 'rm -f "$tmp"' EXIT; curl -fsSL --proto '=https' --proto-redir '=https' '${url}' -o "$tmp" || { echo '${messages.download}' >&2; exit 1; }; expected_sha256='${hash}'; actual_sha256="$(${digestCommand})"; if [ "$actual_sha256" = "$expected_sha256" ]; then bash "$tmp"; else echo '${messages.mismatch}' >&2; exit 1; fi)`;

  return { kind: 'command', label: labels.command, command };
}
