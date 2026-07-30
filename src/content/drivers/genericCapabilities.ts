export function supportsGenericFileUpload(adapter: { uploadStrategy?: unknown }) {
  return Boolean(adapter.uploadStrategy);
}
