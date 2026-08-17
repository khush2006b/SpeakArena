import { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { apiClient as api } from '@/services/api/client';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks (minimum for S3 multipart)
const MAX_CONCURRENCY = 3;

export type UploadStatus = 'idle' | 'uploading' | 'paused' | 'error' | 'success' | 'canceled';

interface MultipartPart {
  PartNumber: number;
  ETag: string;
}

interface UseMultipartUploadProps {
  courseId: string;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export function useMultipartUpload({ courseId, onSuccess, onError }: UseMultipartUploadProps) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const fileRef = useRef<File | null>(null);
  const uploadIdRef = useRef<string | null>(null);
  const resourceIdRef = useRef<string | null>(null);
  const uploadedPartsRef = useRef<MultipartPart[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isPausedRef = useRef(false);

  const resetState = useCallback(() => {
    setStatus('idle');
    setProgress(0);
    setError(null);
    fileRef.current = null;
    uploadIdRef.current = null;
    resourceIdRef.current = null;
    uploadedPartsRef.current = [];
    isPausedRef.current = false;
    abortControllerRef.current = null;
  }, []);

  const uploadParts = async (
    file: File,
    uploadId: string,
    partNumbersToUpload: number[]
  ) => {
    const totalParts = Math.ceil(file.size / CHUNK_SIZE);
    
    // Process in batches (MAX_CONCURRENCY)
    for (let i = 0; i < partNumbersToUpload.length; i += MAX_CONCURRENCY) {
      if (isPausedRef.current) break;

      const batch = partNumbersToUpload.slice(i, i + MAX_CONCURRENCY);
      
      // Get presigned URLs for this batch
      const { data: presignData } = await api.post(`/videos/multipart/${uploadId}/presign-parts`, {
        part_numbers: batch
      }, {
        params: { video_id: resourceIdRef.current }
      });

      const presignedUrls = presignData.data.presigned_urls;

      const uploadPromises = batch.map(async (partNumber) => {
        if (isPausedRef.current) return null;
        
        const start = (partNumber - 1) * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        const url = presignedUrls[partNumber];

        const response = await axios.put(url, chunk, {
          headers: {
            'Content-Type': file.type,
          },
          signal: abortControllerRef.current?.signal as any,
        });

        const eTag = response.headers.etag;
        if (!eTag) throw new Error("No ETag returned from part upload");

        return { PartNumber: partNumber, ETag: eTag };
      });

      const results = await Promise.all(uploadPromises);
      
      for (const result of results) {
        if (result) {
          uploadedPartsRef.current.push(result);
          // Simple progress calculation based on completed chunks
          const currentProgress = Math.round((uploadedPartsRef.current.length / totalParts) * 100);
          setProgress(Math.min(currentProgress, 99)); // Keep at 99 until backend completes
        }
      }
    }
  };

  const startUpload = useCallback(async (file: File, metadata: { title: string, section?: string }) => {
    try {
      resetState();
      setStatus('uploading');
      fileRef.current = file;
      isPausedRef.current = false;
      abortControllerRef.current = new AbortController();

      // 1. Initiate Multipart
      const { data: initData } = await api.post('/videos/multipart/initiate', {
        course_id: courseId,
        title: metadata.title,
        mime_type: file.type,
        file_size_bytes: file.size,
        section: metadata.section,
      });

      const uploadId = initData.data.upload_id;
      const resourceId = initData.data.resource_id;
      
      uploadIdRef.current = uploadId;
      resourceIdRef.current = resourceId;

      const totalParts = Math.ceil(file.size / CHUNK_SIZE);
      const allPartNumbers = Array.from({ length: totalParts }, (_, i) => i + 1);

      // 2. Upload Parts
      await uploadParts(file, uploadId, allPartNumbers);

      // If paused or aborted mid-way, exit here
      if (isPausedRef.current || !uploadIdRef.current) return;

      // 3. Complete
      setStatus('uploading'); // Ensure UI says uploading while finishing
      setProgress(100);

      const { data: completeData } = await api.post(`/videos/multipart/${uploadId}/complete`, {
        upload_id: uploadId,
        parts: uploadedPartsRef.current,
        file_size_bytes: file.size,
      }, {
        params: { video_id: resourceId }
      });

      setStatus('success');
      if (onSuccess) onSuccess(completeData.data);
      
    } catch (err) {
      if (axios.isCancel(err) || isPausedRef.current) {
        // Handled gracefully via pause or cancel
        return;
      }
      
      const parsedError = err instanceof Error ? err : new Error("Upload failed");
      setError(parsedError);
      setStatus('error');
      if (onError) onError(parsedError);
    }
  }, [courseId, onSuccess, onError, resetState]);

  const pauseUpload = useCallback(() => {
    if (status !== 'uploading') return;
    isPausedRef.current = true;
    abortControllerRef.current?.abort(); // Cancel active XHRs
    setStatus('paused');
  }, [status]);

  const resumeUpload = useCallback(async () => {
    if (status !== 'paused' || !fileRef.current || !uploadIdRef.current || !resourceIdRef.current) return;
    
    try {
      setStatus('uploading');
      isPausedRef.current = false;
      abortControllerRef.current = new AbortController();

      const file = fileRef.current;
      const totalParts = Math.ceil(file.size / CHUNK_SIZE);
      const allPartNumbers = Array.from({ length: totalParts }, (_, i) => i + 1);
      
      // Determine which parts are missing
      const uploadedPartNumbers = uploadedPartsRef.current.map(p => p.PartNumber);
      const missingPartNumbers = allPartNumbers.filter(p => !uploadedPartNumbers.includes(p));

      await uploadParts(file, uploadIdRef.current, missingPartNumbers);

      if (isPausedRef.current || !uploadIdRef.current) return;

      setProgress(100);
      const { data: completeData } = await api.post(`/videos/multipart/${uploadIdRef.current}/complete`, {
        upload_id: uploadIdRef.current,
        parts: uploadedPartsRef.current,
        file_size_bytes: file.size,
      }, {
        params: { video_id: resourceIdRef.current }
      });

      setStatus('success');
      if (onSuccess) onSuccess(completeData.data);

    } catch (err) {
      if (axios.isCancel(err) || isPausedRef.current) return;
      
      const parsedError = err instanceof Error ? err : new Error("Upload failed");
      setError(parsedError);
      setStatus('error');
      if (onError) onError(parsedError);
    }
  }, [status, onSuccess, onError]);

  const cancelUpload = useCallback(async () => {
    isPausedRef.current = true;
    abortControllerRef.current?.abort();
    
    if (uploadIdRef.current && resourceIdRef.current) {
      try {
        await api.delete(`/videos/multipart/${uploadIdRef.current}`, {
          params: { video_id: resourceIdRef.current }
        });
      } catch (e) {
        console.error("Failed to abort multipart upload", e);
      }
    }
    
    setStatus('canceled');
    resetState();
  }, [resetState]);

  return {
    status,
    progress,
    error,
    startUpload,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    file: fileRef.current
  };
}
