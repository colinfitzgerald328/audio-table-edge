"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import LoginBtn from "@/components/login-btn"
import { ListBlobResultCustom, ListBlobResultBlobCustom } from "./api/blobs/route"
import { upload } from '@vercel/blob/client'
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { TableLoading } from "@/components/table-loading"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { MoreHorizontal } from "lucide-react"
import { Upload } from "lucide-react"
import { DataTableColumnHeader } from "@/components/data-table-column-header"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import { toast } from "sonner"
import { AuthGate } from "@/components/auth-gate"

// Helper functions
const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (date: Date | string) => {
  if (date instanceof Date) {
    return date.toLocaleString();
  }
  return new Date(date).toLocaleString();
};

export type ListBlobResultBlob = {
  pathname: string
  size: number
  uploadedAt: string
  url: string
  transcription?: string
  transcriptionStatus?: 'pending' | 'completed' | 'error'
}

export default function Page() {
  return (
    <div className="container mx-auto py-4">
      <header className="flex items-center justify-between mb-8 border-b pb-4">
        <h1 className="text-2xl font-bold">Audio Table Edge</h1>
        <LoginBtn />
      </header>
      <AuthGate>
        <div className="space-y-4">
          <React.Suspense fallback={<TableLoading />}>
            <DataTable />
          </React.Suspense>
        </div>
      </AuthGate>
    </div>
  )
}

function DataTable() {
  const [data, setData] = React.useState<ListBlobResultBlobCustom[]>([])
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [isLoading, setIsLoading] = React.useState(true)
  const [uploadState, setUploadState] = React.useState({
    isUploading: false,
    progress: 0,
    error: null as string | null,
  });
  const [selectedTranscription, setSelectedTranscription] = React.useState<string | null>(null);

  // Load initial data
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/blobs");
        if (!response.ok) {
          throw new Error('Failed to fetch blobs');
        }
        const data: ListBlobResultCustom = await response.json();
        
        // Convert the data to match our expected format
        const formattedData = data.blobs.map((blob) => ({
          ...blob,
          // Ensure we have the correct status format
          transcriptionStatus: blob.transcriptionStatus ?? (blob.transcription ? 'completed' : undefined)
        }));
        
        setData(formattedData);
      } catch (error) {
        console.error("Failed to fetch blobs:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleDelete = async (url: string) => {
    const toastId = toast.loading('Deleting file...');
    try {
      console.log('Deleting file:', url);
      const response = await fetch('/api/blobs/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete file');
      }

      // Remove the deleted item from the table
      setData(prevData => prevData.filter(item => item.url !== url));
      
      toast.success('File deleted successfully', {
        id: toastId,
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file', {
        id: toastId,
      });
    }
  };

  const startTranscription = async (blob: { url: string, pathname: string }) => {
    try {
      console.log('Starting transcription for:', blob.pathname);
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          blobUrl: blob.url,
          pathname: blob.pathname,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to start transcription:', errorText);
        // Update the status to error in the table
        setData(prevData =>
          prevData.map(item =>
            item.pathname === blob.pathname
              ? {
                  ...item,
                  transcriptionStatus: 'error' as const,
                  transcription: undefined
                }
              : item
          ) as ListBlobResultBlobCustom[]
        );
      } else {
        const result = await response.json();
        console.log('Transcription completed:', result);
        // Update the status to completed with the transcription
        setData(prevData =>
          prevData.map(item =>
            item.pathname === blob.pathname
              ? { 
                  ...item, 
                  transcriptionStatus: 'completed',
                  transcription: result.transcription 
                }
              : item
          )
        );
      }
    } catch (error) {
      console.error('Error starting transcription:', error);
      // Update the status to error in the table
      setData(prevData =>
        prevData.map(item =>
          item.pathname === blob.pathname
            ? {
                ...item,
                transcriptionStatus: 'error' as const,
                transcription: undefined,
                url: item.url,
                downloadUrl: item.downloadUrl,
                pathname: item.pathname,
                size: item.size,
                uploadedAt: item.uploadedAt
              }
            : item
        ) as ListBlobResultBlobCustom[]
      );
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      validateAudioFile(file);
      console.log('File validation passed:', file.name);

      setUploadState({
        isUploading: true,
        progress: 0,
        error: null
      });

      console.log('Starting file upload');
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        clientPayload: file.type, 
        onUploadProgress: (event) => {
          console.log('Upload progress:', Math.round(event.percentage));
          setUploadState(prev => ({
            ...prev,
            progress: Math.round(event.percentage)
          }));
        },
      });
      console.log('Upload completed, adding to table:', blob.pathname);
      // Add the new blob to the table with pending status
      setData(prevData => [...prevData, {
        pathname: blob.pathname,
        url: blob.url,
        downloadUrl: blob.url,
        size: file.size,
        uploadedAt: new Date(),
        transcriptionStatus: 'pending'
      }] as ListBlobResultBlobCustom[]);
      
      // Start transcription after successful upload
      await startTranscription(blob);

      setUploadState({
        isUploading: false,
        progress: 100,
        error: null
      });

      // Reset the file input
      event.target.value = '';
    } catch (error) {
      console.error('Upload error:', error);
      setUploadState({
        isUploading: false,
        progress: 0,
        error: error instanceof Error ? error.message : 'Failed to upload file'
      });
      // Reset the file input
      event.target.value = '';
    }
  };

  const validateAudioFile = (file: File) => {
    const allowedTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/aac',
      'audio/ogg',
      'audio/webm',
      'audio/x-m4a',
    ];

    if (!allowedTypes.includes(file.type)) {
      throw new Error('Please upload an audio file (MP3, WAV, AAC, OGG, etc.)');
    }

    // 100MB limit
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('File size must be less than 100MB');
    }
  };

  const columns: ColumnDef<ListBlobResultBlobCustom>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "pathname",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="File Name" />
      ),
      cell: ({ row }) => {
        return (
          <div className="flex space-x-2">
            <span className="max-w-[500px] truncate font-medium">
              {row.getValue("pathname")}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: "uploadedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Upload Date" />
      ),
      cell: ({ row }) => {
        return (
          <div className="flex w-[100px] items-center">
            <span>{formatDate(row.getValue("uploadedAt"))}</span>
          </div>
        )
      },
    },
    {
      accessorKey: "size",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Size" />
      ),
      cell: ({ row }) => {
        return (
          <div className="flex w-[100px] items-center">
            <span>{formatBytes(row.getValue("size"))}</span>
          </div>
        )
      },
    },
    {
      accessorKey: "transcriptionStatus",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Transcription" />
      ),
      cell: ({ row }) => {
        const status = row.getValue("transcriptionStatus");
        const transcription = row.original.transcription;

        if (status === 'completed' && transcription) {
          return (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Completed</Badge>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedTranscription(transcription)}
              >
                View
              </Button>
            </div>
          );
        }
        
        if (status === 'pending') {
          return (
            <div className="flex items-center gap-2">
              <Badge>Processing</Badge>
              <Spinner size="sm" className="text-muted-foreground" />
            </div>
          );
        }

        if (status === 'error') {
          return <Badge variant="destructive">Error</Badge>;
        }

        return null;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const blob = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(blob.url)}
              >
                Copy URL
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDelete(blob.url)}
              >
                Delete file
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ];

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  if (isLoading) {
    return <TableLoading />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Input
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload"
          />
          <Button 
            onClick={() => document.getElementById('file-upload')?.click()}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Choose Audio File
          </Button>
          {uploadState.isUploading && (
            <div className="flex items-center gap-2">
              <Progress value={uploadState.progress} className="w-[100px]" />
              <span className="text-sm text-gray-500">
                {uploadState.progress}%
              </span>
            </div>
          )}
        </div>
      </div>

      <DataTableToolbar table={table} />
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No files.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedTranscription} onOpenChange={() => setSelectedTranscription(null)}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>Transcription</DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {selectedTranscription}
            </p>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => {
                if (selectedTranscription) {
                  navigator.clipboard.writeText(selectedTranscription)
                    .then(() => {
                      toast.success('Transcription copied to clipboard')
                    })
                    .catch(() => {
                      toast.error('Failed to copy to clipboard')
                    });
                }
              }}
            >
              Copy to Clipboard
            </Button>
            <Button variant="outline" onClick={() => setSelectedTranscription(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
