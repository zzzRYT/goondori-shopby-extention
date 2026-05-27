export function previewTitle(title: string, userName: string): string {
  return title.replaceAll('{이름}', userName || 'OOO');
}
