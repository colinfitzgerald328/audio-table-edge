import { list } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export interface ListBlobResultBlobCustom {
    url: string;
    downloadUrl: string;
    pathname: string;
    size: number;
    uploadedAt: Date;
    transcription?: string;
    transcriptionStatus?: 'completed';
}

export interface ListBlobResultCustom {
    blobs: ListBlobResultBlobCustom[];
    cursor?: string;
    hasMore: boolean;
}

// Audio file extensions we want to support
const AUDIO_EXTENSIONS = new Set([
    'mp3',
    'm4a',
    'wav',
    'ogg',
    'oga',
    'flac',
    'webm',
]);

// Check if a file is an audio file based on its extension
function isAudioFile(pathname: string): boolean {
    const extension = pathname.split('.').pop()?.toLowerCase();
    return extension ? AUDIO_EXTENSIONS.has(extension) : false;
}

async function getTranscription(pathname: string): Promise<string | undefined> {
    try {
        const transcriptionPath = pathname + '_transcription.json';
        const { blobs } = await list();
        const transcriptionFile = blobs.find(b => b.pathname === transcriptionPath);
        
        if (transcriptionFile) {
            const response = await fetch(transcriptionFile.url);
            if (response.ok) {
                const data = await response.json();
                return data.text;
            }
        }
        return undefined;
    } catch (error) {
        console.error('Error fetching transcription:', error);
        return undefined;
    }
}

export async function GET(): Promise<NextResponse> {
    // Check authentication
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
        return authResult;
    }

    try {
        const { blobs }: ListBlobResultCustom = await list({
            token: process.env.BLOB_READ_WRITE_TOKEN,
        });

        // Filter for audio files and exclude transcription JSON files
        const audioBlobs = blobs.filter(blob => 
            isAudioFile(blob.pathname) && 
            !blob.pathname.endsWith('_transcription.json')
        );

        // Check for transcriptions for each audio file
        const blobsWithTranscriptions = await Promise.all(
            audioBlobs.map(async (blob) => {
                const transcription = await getTranscription(blob.pathname);
                return {
                    ...blob,
                    transcription,
                    transcriptionStatus: transcription ? 'completed' : undefined
                };
            })
        );

        return NextResponse.json({ blobs: blobsWithTranscriptions });
    } catch (error) {
        console.error('Error fetching blobs:', error);
        return NextResponse.json(
            { error: 'Error fetching blobs' },
            { status: 500 }
        );
    }
}
