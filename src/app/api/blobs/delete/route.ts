import { del } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function POST(request: Request): Promise<NextResponse> {
    // Check authentication
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
        return authResult;
    }

    try {
        const { url } = await request.json();
        
        if (!url) {
            return NextResponse.json(
                { error: 'URL is required' },
                { status: 400 }
            );
        }

        console.log('Deleting blob:', url);
        await del(url);
        
        return NextResponse.json({ 
            success: true,
            message: 'File deleted successfully'
        });
    } catch (error) {
        console.error('Delete error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error occurred' },
            { status: 500 }
        );
    }
}
