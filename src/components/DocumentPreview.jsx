import React, { useState } from 'react';
import { X, Download, ExternalLink, ZoomIn, ZoomOut, RotateCw, FileText, Image } from 'lucide-react';

const DOCUMENT_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'tiff', 'tif', 'gif', 'bmp', 'webp', 'svg']);

function getDocumentType(artifact) {
    const fname = artifact?.filename || '';
    const ext = fname.split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'tif'].includes(ext)) return 'image';
    return 'unknown';
}

const DocumentPreview = ({ artifact, onClose }) => {
    const [zoom, setZoom] = useState(100);
    const [rotation, setRotation] = useState(0);
    const docType = getDocumentType(artifact);
    const fileUrl = artifact?.url || artifact?.file_url || '';
    const fileName = artifact?.filename || 'Document';
    const fileSize = artifact?.metadata?.file_size_bytes || artifact?.file_size_bytes;

    const formatSize = (bytes) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1048576).toFixed(1)} MB`;
    };

    const handleDownload = () => {
        if (fileUrl) {
            const a = document.createElement('a');
            a.href = fileUrl;
            a.download = fileName;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#111] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#222] bg-[#111] z-10 w-full">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="p-1.5 bg-[#1a1a1a] rounded">
                        {docType === 'pdf'
                            ? <FileText className="w-4 h-4 text-red-500" strokeWidth={1.5} />
                            : <Image className="w-4 h-4 text-blue-500" strokeWidth={1.5} />
                        }
                    </div>
                    <div className="min-w-0">
                        <span className="text-[14px] font-medium text-[#e8e8e8] truncate block">{fileName}</span>
                        {fileSize && (
                            <span className="text-[11px] text-[#555]">{formatSize(fileSize)}</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={handleDownload} title="Download"
                        className="p-1.5 hover:bg-[#1a1a1a] rounded text-[#555] hover:text-[#888] transition-colors">
                        <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => fileUrl && window.open(fileUrl, '_blank')} title="Open in new tab"
                        className="p-1.5 hover:bg-[#1a1a1a] rounded text-[#555] hover:text-[#888] transition-colors">
                        <ExternalLink className="w-4 h-4" />
                    </button>
                    {onClose && (
                        <button onClick={onClose} title="Close"
                            className="p-1.5 hover:bg-[#1a1a1a] rounded text-[#555] hover:text-[#888] transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Toolbar for zoom/rotate (images) */}
            {docType === 'image' && (
                <div className="flex items-center justify-center gap-2 px-4 py-2 border-b border-[#222] bg-[#111]">
                    <button onClick={() => setZoom(z => Math.max(25, z - 25))}
                        className="p-1 hover:bg-[#2a2a2a] rounded text-[#666]"><ZoomOut className="w-4 h-4" /></button>
                    <span className="text-[11px] text-[#666] w-12 text-center">{zoom}%</span>
                    <button onClick={() => setZoom(z => Math.min(300, z + 25))}
                        className="p-1 hover:bg-[#2a2a2a] rounded text-[#666]"><ZoomIn className="w-4 h-4" /></button>
                    <div className="w-px h-4 bg-[#2a2a2a] mx-1" />
                    <button onClick={() => setRotation(r => (r + 90) % 360)}
                        className="p-1 hover:bg-[#2a2a2a] rounded text-[#666]"><RotateCw className="w-4 h-4" /></button>
                    <button onClick={() => setZoom(100)}
                        className="px-2 py-0.5 text-[10px] text-[#666] hover:bg-[#2a2a2a] rounded">Reset</button>
                </div>
            )}

            {/* Document content */}
            <div className="flex-1 overflow-auto bg-[#1a1a1a]">
                {docType === 'pdf' && fileUrl ? (
                    <iframe
                        src={`${fileUrl}#toolbar=1&navpanes=0`}
                        className="w-full h-full border-0"
                        title={fileName}
                        style={{ minHeight: '100%' }}
                    />
                ) : docType === 'image' && fileUrl ? (
                    <div className="flex items-center justify-center p-4 min-h-full">
                        <img
                            src={fileUrl}
                            alt={fileName}
                            style={{
                                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                                transition: 'transform 0.2s ease',
                                maxWidth: zoom <= 100 ? '100%' : 'none',
                            }}
                            className="shadow-lg rounded"
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-[#555]">
                        <FileText className="w-12 h-12" strokeWidth={1} />
                        <p className="text-sm">Preview not available</p>
                        <button onClick={handleDownload}
                            className="px-3 py-1.5 bg-[#1a1a1a] text-[#ccc] text-xs rounded-md hover:bg-[#2a2a2a] transition-colors border border-[#333]">
                            Download File
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentPreview;
