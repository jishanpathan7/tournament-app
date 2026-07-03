import type {
  BulkCheckInRequest,
  BulkCheckInResult,
  CheckInRequest,
  DetectColumnsRequest,
  DetectColumnsResponse,
  DivisionReadinessView,
  ImportPreview,
  ImportRequest,
  ImportResult,
  ImportSourceInfo,
  MappingTemplateView,
  ParticipantAttendanceView,
  SaveMappingTemplateRequest,
  TournamentReadinessView,
} from "@tournament/api-client";

import { api, apiGet } from "@/lib/api";

/** Typed transport for Registration Operations — CSV import, attendance check-in, readiness. */

// ---- import sources ----

export function listImportSources(): Promise<ImportSourceInfo[]> {
  return apiGet<ImportSourceInfo[]>("/imports/sources");
}

export async function detectColumns(body: DetectColumnsRequest): Promise<DetectColumnsResponse> {
  const { data } = await api.post<DetectColumnsResponse>("/imports/detect", body);
  return data;
}

// ---- import (preview + commit) ----

export async function previewImport(
  divisionId: string,
  body: ImportRequest,
): Promise<ImportPreview> {
  const { data } = await api.post<ImportPreview>(
    `/divisions/${divisionId}/imports/preview`,
    body,
  );
  return data;
}

export async function commitImport(
  divisionId: string,
  body: ImportRequest,
): Promise<ImportResult> {
  const { data } = await api.post<ImportResult>(`/divisions/${divisionId}/imports/commit`, body);
  return data;
}

// ---- mapping templates ----

export function listMappingTemplates(source?: string): Promise<MappingTemplateView[]> {
  const qs = source ? `?source=${encodeURIComponent(source)}` : "";
  return apiGet<MappingTemplateView[]>(`/imports/mapping-templates${qs}`);
}

export async function saveMappingTemplate(
  body: SaveMappingTemplateRequest,
): Promise<MappingTemplateView> {
  const { data } = await api.post<MappingTemplateView>("/imports/mapping-templates", body);
  return data;
}

export async function deleteMappingTemplate(templateId: string): Promise<void> {
  await api.delete(`/imports/mapping-templates/${templateId}`);
}

// ---- attendance / check-in ----

export function listAttendance(divisionId: string): Promise<ParticipantAttendanceView[]> {
  return apiGet<ParticipantAttendanceView[]>(`/divisions/${divisionId}/attendance`);
}

export async function setAttendance(
  participantId: string,
  body: CheckInRequest,
): Promise<ParticipantAttendanceView> {
  const { data } = await api.post<ParticipantAttendanceView>(
    `/participants/${participantId}/attendance`,
    body,
  );
  return data;
}

export async function bulkSetAttendance(
  divisionId: string,
  body: BulkCheckInRequest,
): Promise<BulkCheckInResult> {
  const { data } = await api.post<BulkCheckInResult>(
    `/divisions/${divisionId}/attendance/bulk`,
    body,
  );
  return data;
}

// ---- readiness ----

export function getTournamentReadiness(tournamentId: string): Promise<TournamentReadinessView> {
  return apiGet<TournamentReadinessView>(`/tournaments/${tournamentId}/readiness`);
}

export function getDivisionReadiness(
  tournamentId: string,
  divisionId: string,
): Promise<DivisionReadinessView | null> {
  return getTournamentReadiness(tournamentId).then(
    (r) => r.divisions.find((d) => d.divisionId === divisionId) ?? null,
  );
}
