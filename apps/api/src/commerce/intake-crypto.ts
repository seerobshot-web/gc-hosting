import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
function key(hex: string | undefined): Buffer {
  if (!hex || !/^[a-fA-F0-9]{64}$/.test(hex))
    throw new ServiceUnavailableException("intake_key_missing");
  return Buffer.from(hex, "hex");
}
export function encryptIntake(base64: string, binding: string, hexKey: string | undefined) {
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > 512 * 1024 || bytes.toString("base64") !== base64)
    throw new BadRequestException("invalid_intake_file");
  const mime =
    bytes.subarray(0, 5).toString() === "%PDF-"
      ? "application/pdf"
      : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? "image/png"
        : null;
  if (!mime) throw new BadRequestException("intake_requires_pdf_or_png");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(hexKey), nonce);
  cipher.setAAD(Buffer.from(binding));
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return { encrypted: Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]), mime };
}
export function decryptIntake(
  encrypted: Buffer,
  binding: string,
  hexKey: string | undefined,
): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key(hexKey), encrypted.subarray(0, 12));
  decipher.setAAD(Buffer.from(binding));
  decipher.setAuthTag(encrypted.subarray(12, 28));
  return Buffer.concat([decipher.update(encrypted.subarray(28)), decipher.final()]);
}
