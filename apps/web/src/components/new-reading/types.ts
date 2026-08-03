import type {
  AgentProfile,
  DrawSource,
  Spread,
} from "@aethertarot/shared-types";

export interface AgentProfileOption {
  id: AgentProfile;
  name: string;
  subtitle: string;
  description: string;
  badge?: string;
}

export interface DrawSourceOption {
  id: DrawSource;
  name: string;
  description: string;
}

export interface SpreadCatalogueProps {
  spreads: Spread[];
  selectedSpread: Spread | null;
  onSelect: (spread: Spread) => void;
}
