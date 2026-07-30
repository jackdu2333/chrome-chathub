export const MAX_FILE_COUNT = 5;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_FILE_SIZE_BYTES = 20 * 1024 * 1024;

interface FileDescriptor {
  name: string;
  size: number;
}

export type UploadLimitViolation =
  | { code: 'TOO_MANY_FILES' }
  | { code: 'FILE_TOO_LARGE'; fileName: string }
  | { code: 'TOTAL_TOO_LARGE' };

export function validateUploadSelection(
  existingFiles: readonly FileDescriptor[],
  incomingFiles: readonly FileDescriptor[]
): UploadLimitViolation | null {
  if (existingFiles.length + incomingFiles.length > MAX_FILE_COUNT) {
    return { code: 'TOO_MANY_FILES' };
  }

  const oversizedFile = incomingFiles.find((file) => file.size > MAX_FILE_SIZE_BYTES);
  if (oversizedFile) {
    return { code: 'FILE_TOO_LARGE', fileName: oversizedFile.name };
  }

  const totalSize = [...existingFiles, ...incomingFiles]
    .reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_TOTAL_FILE_SIZE_BYTES) {
    return { code: 'TOTAL_TOO_LARGE' };
  }

  return null;
}
