// আপলোডের আগে ব্রাউজারেই বড় ছবি ছোট করা: লম্বা দিক ≤২০৪৮px, WebP (না পারলে JPEG) quality ০.৯।
// ফোনের ১০-১৫MB ছবি সাধারণত ০.৫-১.৫MB হয়, চোখে পার্থক্য প্রায় থাকে না; সার্ভার আবার যাচাই করে দুই মাপ বানায়।
const MAX_EDGE = 2048;
const KEEP_IF_UNDER = 1.5 * 1024 * 1024;
export const MAX_INPUT = 30 * 1024 * 1024;

export async function compressImage(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("শুধু ছবি দিন (JPG, PNG বা WEBP); ভিডিও বা অন্য ফাইল চলবে না");
  if (file.size > MAX_INPUT) throw new Error("ছবিটা ৩০MB-এর বেশি, ছোট ছবি দিন");
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bmp) throw new Error("ছবিটা খোলা যায়নি");
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size <= KEEP_IF_UNDER) {
    bmp.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
  let out = await toBlob("image/webp", 0.9);
  if (!out || out.type !== "image/webp") out = await toBlob("image/jpeg", 0.9); // পুরোনো Safari WebP বানাতে পারে না
  if (!out) throw new Error("ছবি প্রস্তুত করা যায়নি");
  return out.size < file.size ? out : file;
}
