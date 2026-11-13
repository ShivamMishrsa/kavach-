import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Keeps the chosen file and a preview URL for images together.
 * The URL is created when the file is chosen and revoked when it changes or the screen closes.
 */
export function useFilePreview() {
  const [state, setState] = useState<{ file: File | null; url: string | null }>({
    file: null,
    url: null,
  });
  const urlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const setFile = useCallback((file: File | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    urlRef.current = url;
    setState({ file, url });
  }, []);

  return { file: state.file, previewUrl: state.url, setFile };
}
