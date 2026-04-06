import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') || '';

  try {
    let uploadResult;

    if (contentType.includes('multipart/form-data')) {
      // File upload
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = `data:${file.type};base64,${buffer.toString('base64')}`;

      uploadResult = await cloudinary.uploader.upload(base64, {
        folder: 'yt-thumbnails',
        resource_type: 'image',
      });
    } else {
      // URL upload
      const body = await req.json();
      const url = body.url;
      if (!url || typeof url !== 'string') {
        return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
      }

      uploadResult = await cloudinary.uploader.upload(url, {
        folder: 'yt-thumbnails',
        resource_type: 'image',
      });
    }

    return NextResponse.json({ cloudinaryUrl: uploadResult.secure_url });
  } catch (err: unknown) {
    const errObj = err as Record<string, unknown>;
    const nested = errObj?.error as Record<string, unknown> | undefined;
    const message = (errObj?.message as string) || (nested?.message as string) || JSON.stringify(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
