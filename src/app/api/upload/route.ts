import { handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function POST(request: Request): Promise<NextResponse> {
  // Check authentication
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const body = await request.json();

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ['audio/*'],
          tokenPayload: JSON.stringify({
            // Optional, sent to your webhook
          }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        // Handle the completed upload
        console.log('Upload completed:', blob);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Error uploading file' },
      { status: 500 }
    );
  }
}
