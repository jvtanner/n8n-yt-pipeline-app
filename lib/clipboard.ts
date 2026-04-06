export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function formatBriefForCopy(brief: {
  title?: string;
  thumbnailText?: string;
  hook?: string;
  intro?: string;
  claim?: string;
}): string {
  const lines: string[] = [];
  if (brief.title) lines.push(`TITLE: ${brief.title}`);
  if (brief.thumbnailText) lines.push(`THUMBNAIL TEXT: ${brief.thumbnailText}`);
  if (brief.hook) lines.push(`HOOK: ${brief.hook}`);
  if (brief.intro) lines.push(`INTRO: ${brief.intro}`);
  if (brief.claim) lines.push(`CLAIM: ${brief.claim}`);
  return lines.join('\n\n');
}
