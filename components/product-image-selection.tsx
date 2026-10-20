'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

const ProductImageContext = createContext<{
  image: string | null;
  selectImage: (image: string | null) => void;
} | null>(null);

export function ProductImageSelection({ initialImage, children }: {
  initialImage: string | null;
  children: ReactNode;
}) {
  const [image, selectImage] = useState(initialImage);
  return (
    <ProductImageContext.Provider value={{ image, selectImage }}>
      {children}
    </ProductImageContext.Provider>
  );
}

export function useProductImageSelection() {
  return useContext(ProductImageContext);
}
