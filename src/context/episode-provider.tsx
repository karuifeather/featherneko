import { Episode } from '@/types';
import React, { createContext, useContext, useState } from 'react';

interface EpisodeContextType {
  selectedEpisode: Episode | null;
  setSelectedEpisode: (episode: Episode | null) => void;
}

const EpisodeContext = createContext<EpisodeContextType | undefined>(undefined);

export const useEpisodeContext = () => {
  const context = useContext(EpisodeContext);
  if (!context) {
    throw new Error('useEpisodeContext must be used within an EpisodeProvider');
  }
  return context;
};

const EpisodeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);

  return (
    <EpisodeContext.Provider value={{ selectedEpisode, setSelectedEpisode }}>
      {children}
    </EpisodeContext.Provider>
  );
};

export default EpisodeProvider;
