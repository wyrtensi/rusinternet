import { describe, expect, it } from 'vitest';
import { detectPlatform, getInstallAction } from '../src/lib/platform';

const installerHashes = {
  macos: 'A'.repeat(64),
  linux: 'B'.repeat(64)
};

describe('detectPlatform', () => {
  it.each([
    ['windows', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'],
    ['android', 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36'],
    ['ios', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X)'],
    ['ios', 'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X)'],
    ['macos', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_6)'],
    ['linux', 'Mozilla/5.0 (X11; Linux x86_64)']
  ])('returns %s for a representative user agent', (expected, userAgent) => {
    expect(detectPlatform(userAgent)).toBe(expected);
  });

  it('checks Android before the generic Linux marker', () => {
    expect(detectPlatform('Linux armv8l Android 15')).toBe('android');
  });

  it('returns null when the platform cannot be inferred', () => {
    expect(detectPlatform('CustomBrowser/1.0')).toBeNull();
  });
});

describe('getInstallAction', () => {
  it('offers one direct installer download on Windows', () => {
    expect(getInstallAction('windows', 'ru', installerHashes)).toEqual({
      kind: 'download',
      label: 'Установить',
      href: '/downloads/install-windows.cmd'
    });
  });

  it.each([
    ['macos', 'macos'],
    ['linux', 'linux']
  ] as const)('offers one verified terminal command on %s', (platform, slug) => {
    const action = getInstallAction(platform, 'ru', installerHashes);
    if (action.kind !== 'command') throw new Error(`Expected command action for ${platform}`);
    expect(action.label).toBe('Скопировать команду установки');
    expect(action.command).toContain(`https://rusinternet.com/downloads/install-${slug}.sh`);
    expect(action.command).toContain('sha256');
    expect(action.command).toContain(installerHashes[platform].toLowerCase());
  });

  it('uses the Apple profile as the single iOS install action', () => {
    expect(getInstallAction('ios', 'ru', installerHashes)).toEqual({
      kind: 'download',
      label: 'Установить профиль',
      href: '/downloads/profile/russiantrusted.mobileconfig'
    });
  });

  it('starts the Android system-settings guide instead of promising automation', () => {
    expect(getInstallAction('android', 'ru', installerHashes)).toEqual({
      kind: 'guide',
      label: 'Начать установку',
      href: '/install/android/'
    });
  });
});
