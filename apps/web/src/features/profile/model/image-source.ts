/** Procesamiento de imágenes locales para perfil / KYC (data URL). */

export const IMAGE_ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export type ImageProcessOptions = {
  maxSourceBytes?: number;
  maxEdgePx?: number;
  jpegQuality?: number;
};

const DEFAULTS: Required<ImageProcessOptions> = {
  maxSourceBytes: 1 * 1024 * 1024,
  maxEdgePx: 512,
  jpegQuality: 0.82,
};

export const KYC_IMAGE_OPTIONS: Required<ImageProcessOptions> = {
  maxSourceBytes: 2 * 1024 * 1024,
  maxEdgePx: 1280,
  jpegQuality: 0.82,
};

/** Comprobante de domicilio: imagen (mismas reglas KYC) o PDF hasta 4 MB. */
export const KYC_ADDRESS_PROOF_MAX_BYTES = 4 * 1024 * 1024;

export const ADDRESS_PROOF_ACCEPTED_TYPES = [
  ...IMAGE_ACCEPTED_TYPES,
  'application/pdf',
] as const;

export async function fileToAddressProofDataUrl(file: File): Promise<string> {
  const isPdf =
    file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (isPdf) {
    if (file.size > KYC_ADDRESS_PROOF_MAX_BYTES) {
      throw new Error('El PDF supera 4 MB. Elegí un archivo más liviano.');
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('No se pudo leer el PDF.'));
      };
      reader.onerror = () => reject(new Error('No se pudo leer el PDF.'));
      reader.readAsDataURL(file);
    });
  }
  return fileToImageDataUrl(file, KYC_IMAGE_OPTIONS);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    img.src = src;
  });
}

function fitWithin(width: number, height: number, maxEdge: number) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function fileToImageDataUrl(
  file: File,
  options: ImageProcessOptions = {},
): Promise<string> {
  const { maxSourceBytes, maxEdgePx, jpegQuality } = { ...DEFAULTS, ...options };

  if (!(IMAGE_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    throw new Error('Formato no soportado. Usá JPG, PNG, WEBP o GIF.');
  }
  if (file.size > maxSourceBytes) {
    const mb = Math.round((maxSourceBytes / (1024 * 1024)) * 10) / 10;
    throw new Error(`La imagen supera ${mb} MB. Elegí un archivo más liviano.`);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, maxEdgePx);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo procesar la imagen.');
    ctx.drawImage(img, 0, 0, width, height);

    if (file.type !== 'image/jpeg' && file.type !== 'image/webp') {
      const opaque = document.createElement('canvas');
      opaque.width = width;
      opaque.height = height;
      const octx = opaque.getContext('2d');
      if (!octx) throw new Error('No se pudo procesar la imagen.');
      octx.fillStyle = '#ffffff';
      octx.fillRect(0, 0, width, height);
      octx.drawImage(canvas, 0, 0);
      return opaque.toDataURL('image/jpeg', jpegQuality);
    }
    return canvas.toDataURL('image/jpeg', jpegQuality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
