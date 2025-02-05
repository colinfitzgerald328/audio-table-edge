import { del } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function DELETE(request: Request) {
  try {
    const { pathname } = await request.json();

    if (!pathname) {
      return NextResponse.json(
        { error: 'No pathname provided' },
        { status: 400 }
      );
    }

    // Delete the audio file
    await del(pathname);

    // Also delete the transcription file if it exists
    const transcriptionPath = pathname.replace(/\.[^/.]+$/, '') + '_transcription.json';
    try {
      await del(transcriptionPath);
    } catch (error) {
      // Ignore error if transcription file doesn't exist
      console.log('No transcription file found or error deleting it:', error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}
