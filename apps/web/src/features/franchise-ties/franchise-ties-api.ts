import { api, apiGet } from "@/lib/api";

export interface TieLegView {
  id: string;
  status: string;
  legIndex: number;
  homePairName: string;
  awayPairName: string;
}

export interface FranchiseTieView {
  id: string;
  status: string;
  homeSquadName: string;
  awaySquadName: string;
  homeLegWins: number;
  awayLegWins: number;
  gamesPerTie: number;
  legs: TieLegView[];
}

export interface FranchiseTiesBoardView {
  stageId: string;
  gamesPerTie: number;
  ties: FranchiseTieView[];
}

export interface FranchiseDrawResponse {
  stageId: string;
  summary: {
    ties: number;
    legs: number;
    gamesPerTie: number;
    squadCount: number;
  };
}

export interface SquadStandingRow {
  rank: number;
  squadName: string;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  legWins: number;
  legLosses: number;
  points: number;
}

export interface SquadStandingsView {
  stageId: string;
  rows: SquadStandingRow[];
}

export interface SquadTierProfileView {
  squadId: string;
  squadName: string;
  profile: number[];
  aligned: boolean;
}

export interface PairingTierCheckView {
  aligned: boolean;
  referenceProfile: number[];
  squads: SquadTierProfileView[];
  deviatingSquads: string[];
}

export function getFranchiseStandings(stageId: string): Promise<SquadStandingsView> {
  return apiGet<SquadStandingsView>(`/stages/${stageId}/franchise-standings`);
}

export function getPairingTierCheck(stageId: string): Promise<PairingTierCheckView> {
  return apiGet<PairingTierCheckView>(`/stages/${stageId}/pairing-tier-check`);
}

export function getFranchiseTiesBoard(stageId: string): Promise<FranchiseTiesBoardView> {
  return apiGet<FranchiseTiesBoardView>(`/stages/${stageId}/franchise-ties`);
}

export async function generateFranchiseDraw(
  stageId: string,
  gamesPerTie?: number,
): Promise<FranchiseDrawResponse> {
  const { data } = await api.post<FranchiseDrawResponse>(`/stages/${stageId}/franchise-draw`, {
    gamesPerTie,
  });
  return data;
}

export async function generateFranchiseKnockoutDraw(
  stageId: string,
  opts?: { sourceStageId?: string; advanceCount?: number; gamesPerTie?: number },
): Promise<FranchiseDrawResponse> {
  const { data } = await api.post<FranchiseDrawResponse>(
    `/stages/${stageId}/franchise-knockout-draw`,
    {
      sourceStageId: opts?.sourceStageId,
      advanceCount: opts?.advanceCount,
      gamesPerTie: opts?.gamesPerTie,
    },
  );
  return data;
}
