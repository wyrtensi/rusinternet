interface ClipboardWriter {
  writeText(text: string): Promise<void>;
}

interface TextTarget {
  textContent: string | null;
}

export async function copyTextAndSetLabel(
  text: string,
  target: TextTarget,
  label: string,
  clipboard: ClipboardWriter
): Promise<void> {
  await clipboard.writeText(text);
  target.textContent = label;
}
