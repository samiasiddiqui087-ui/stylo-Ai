export function formatPkr(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `Rs. ${safe.toLocaleString('en-PK')}`;
}

export function formatDateIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatReadableDate(dateStr: string): string {
  const parsed = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTimestamp(ts: unknown): string {
  if (!ts) return 'Just now';
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().toLocaleString('en-PK', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }
  if (typeof ts === 'string' || typeof ts === 'number') {
    const d = new Date(ts);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' });
    }
  }
  return 'Recent';
}

export function compressImageFileToDataUrl(file: File, maxDim = 768, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
