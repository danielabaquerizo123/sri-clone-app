import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import puppeteer from "puppeteer";

export type StoredProfileImage = {
  url: string;
  publicId: string;
};

type UploadParams = {
  userId: string;
  file: Express.Multer.File;
  publicBaseUrl: string;
};

type ReplaceParams = UploadParams & {
  previousPublicId?: string | null;
};

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const maxFileSizeBytes = 2 * 1024 * 1024;
const maxInputDimension = 4096;
const outputSize = 512;
const uploadRoot = path.resolve(process.cwd(), "uploads/profile-images");

export class ProfileImageStorageService {
  async uploadProfileImage(params: UploadParams): Promise<StoredProfileImage> {
    this.validateUpload(params.file);

    const processed = await this.processImage(params.file);
    const safeUserId = params.userId.replace(/[^a-zA-Z0-9_-]/g, "");
    const publicId = `${safeUserId}-${Date.now()}-${crypto.randomBytes(8).toString("hex")}.webp`;
    const filePath = this.resolvePublicId(publicId);

    await fs.mkdir(uploadRoot, { recursive: true });
    await fs.writeFile(filePath, processed);

    return {
      publicId,
      url: `${params.publicBaseUrl.replace(/\/$/, "")}/uploads/profile-images/${publicId}`,
    };
  }

  async replaceProfileImage(params: ReplaceParams): Promise<StoredProfileImage> {
    return this.uploadProfileImage(params);
  }

  async deleteProfileImage(publicId?: string | null): Promise<void> {
    if (!publicId) return;

    try {
      await fs.unlink(this.resolvePublicId(publicId));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  async deleteUploadedAfterFailure(publicId?: string | null): Promise<void> {
    try {
      await this.deleteProfileImage(publicId);
    } catch (error) {
      console.error("No se pudo limpiar la imagen de perfil temporal:", error);
    }
  }

  private validateUpload(file: Express.Multer.File) {
    if (!file || !file.buffer?.length) {
      throw new ProfileImageValidationError("Seleccione una imagen válida.");
    }

    if (file.size > maxFileSizeBytes || file.buffer.length > maxFileSizeBytes) {
      throw new ProfileImageValidationError("La imagen no puede superar 2 MB.");
    }

    const extension = path.extname(file.originalname || "").toLowerCase();

    if (!allowedExtensions.has(extension)) {
      throw new ProfileImageValidationError("Formato no permitido. Use JPG, PNG o WEBP.");
    }

    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new ProfileImageValidationError("Formato no permitido. Use JPG, PNG o WEBP.");
    }

    if (!this.matchesMagicBytes(file.buffer, file.mimetype)) {
      throw new ProfileImageValidationError("El archivo no corresponde a una imagen válida.");
    }
  }

  private async processImage(file: Express.Multer.File): Promise<Buffer> {
    const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      const result = await page.evaluate(
        async ({ src, size, maxDimension }) => {
          const browserWindow = globalThis as any;
          const image = new browserWindow.Image();
          image.decoding = "sync";
          image.src = src;

          await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error("No se pudo leer la imagen."));
          });

          if (!image.naturalWidth || !image.naturalHeight) {
            throw new Error("La imagen está vacía o corrupta.");
          }

          if (image.naturalWidth > maxDimension || image.naturalHeight > maxDimension) {
            throw new Error("La imagen excede las dimensiones máximas permitidas.");
          }

          const canvas = browserWindow.document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;

          const context = canvas.getContext("2d");
          if (!context) throw new Error("No se pudo procesar la imagen.");

          const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
          const sourceX = Math.floor((image.naturalWidth - sourceSize) / 2);
          const sourceY = Math.floor((image.naturalHeight - sourceSize) / 2);

          context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);

          return canvas.toDataURL("image/webp", 0.86);
        },
        { src: dataUrl, size: outputSize, maxDimension: maxInputDimension }
      );

      const base64 = result.replace(/^data:image\/webp;base64,/, "");
      return Buffer.from(base64, "base64");
    } catch (error) {
      throw new ProfileImageValidationError(
        error instanceof Error ? error.message : "No se pudo procesar la imagen."
      );
    } finally {
      await browser.close();
    }
  }

  private matchesMagicBytes(buffer: Buffer, mimetype: string) {
    if (mimetype === "image/jpeg") {
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9;
    }

    if (mimetype === "image/png") {
      return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }

    if (mimetype === "image/webp") {
      return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
    }

    return false;
  }

  private resolvePublicId(publicId: string) {
    const safeName = path.basename(publicId);
    const resolved = path.resolve(uploadRoot, safeName);

    if (!resolved.startsWith(uploadRoot)) {
      throw new Error("Identificador de imagen inválido.");
    }

    return resolved;
  }
}

export class ProfileImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileImageValidationError";
  }
}

export const profileImageStorageService = new ProfileImageStorageService();
