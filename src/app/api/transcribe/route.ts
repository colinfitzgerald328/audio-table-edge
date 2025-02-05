import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { put, del } from '@vercel/blob';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function downloadToTemp(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to download file');
  
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, 'audio_' + Date.now() + path.extname(url));
  
  const fileStream = fs.createWriteStream(tempFile);
  if (!response.body) {
    throw new Error('Response body is null');
  }
  
  // Use as any to bypass the type checking since we know the stream is compatible
  await pipeline(
    Readable.fromWeb(response.body as never),
    fileStream
  );
  
  return tempFile;
}

async function transcribeAudio(filePath: string): Promise<string> {
  console.log('Starting transcription for file:', filePath);
  
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
    });

    console.log('Transcription completed successfully');
    return transcription.text;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Transcription error:', errorMessage);
    throw error;
  }
}

export async function POST(request: Request) {
  let tempFilePath: string | undefined;
  
  try {
    console.info('Transcription process started');
    
    const { blobUrl, pathname } = await request.json();
    if (!blobUrl) {
      return NextResponse.json(
        { error: 'No blob URL provided' },
        { status: 400 }
      );
    }

    // Download file to temp directory
    console.log('Downloading file to temp directory');
    tempFilePath = await downloadToTemp(blobUrl);
    console.log('File downloaded to:', tempFilePath);

    // Transcribe the audio
    const transcriptionText = await transcribeAudio(tempFilePath);

    // Store transcription result
    const transcriptionBlob = await put(
      pathname + '_transcription.json',
      JSON.stringify({ text: transcriptionText }),
      { access: 'public' }
    );

    return NextResponse.json({
      success: true,
      transcription: transcriptionText,
      transcriptionUrl: transcriptionBlob.url
    });

  } catch (error) {
    console.error('Error in transcription process:', error);    
    return NextResponse.json(
      { error: "Failed to transcribe audio" },
      { status: 500 }
    );
  } finally {
    // Ensure temp file is cleaned up
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log('Cleaned up temporary file:', tempFilePath);
      } catch (error) {
        console.error('Error cleaning up temp file:', error);
      }
    }
  }
}

export async function DELETE(request: Request) {
  try {
    const { pathname } = await request.json();
    
    // Delete both the audio file and its transcription if it exists
    await del(pathname);
    try {
      await del(pathname + '_transcription.json');
    } catch (error) {
      // Ignore error if transcription doesn't exist
      console.log('No transcription file found to delete due to:', error);
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
