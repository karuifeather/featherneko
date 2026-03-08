import { Anime } from '@/types';
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SelectedAnimeContextType {
  selectedAnime: Partial<Anime> | null;
  setSelectedAnime: (anime: Partial<Anime>) => void;
}

const SelectedAnimeContext = createContext<
  SelectedAnimeContextType | undefined
>(undefined);

export const SelectedAnimeProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [selectedAnime, setSelectedAnime] = useState<Partial<Anime> | null>(
    null
  );

  return (
    <SelectedAnimeContext.Provider value={{ selectedAnime, setSelectedAnime }}>
      {children}
    </SelectedAnimeContext.Provider>
  );
};

export const useSelectedAnime = (): SelectedAnimeContextType => {
  const context = useContext(SelectedAnimeContext);
  if (!context) {
    throw new Error(
      'useSelectedAnime must be used within a SelectedAnimeProvider'
    );
  }
  return context;
};
