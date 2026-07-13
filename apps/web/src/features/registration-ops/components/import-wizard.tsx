"use client";

import type {
  ImportFieldInfo,
  ImportPreview,
  ImportResult,
  ImportSourceInfo,
  MappingTemplateView,
  PreviewRow,
} from "@tournament/api-client";
import {
  AlertCircle,
  ArrowLeft,
  BookMarked,
  CheckCircle2,
  ChevronRight,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import {
  useCommitImport,
  useDeleteMappingTemplate,
  useImportSources,
  useMappingTemplates,
  useSaveMappingTemplate,
} from "@/features/registration-ops/use-registration-ops";
import * as opsApi from "@/features/registration-ops/registration-ops-api";
import { errorMessage } from "@/lib/problem";

type Step = "upload" | "map" | "preview" | "done";

const ROW_STATUS_META: Record<
  PreviewRow["status"],
  { label: string; tone: "mint" | "candy" | "yellow" | "pink" }
> = {
  new: { label: "New", tone: "mint" },
  update: { label: "Update", tone: "candy" },
  duplicate: { label: "Duplicate", tone: "yellow" },
  invalid: { label: "Invalid", tone: "pink" },
};

export function ImportWizard({
  tournamentId,
  divisionId,
  embedded = false,
}: {
  tournamentId: string;
  divisionId: string;
  embedded?: boolean;
}) {
  const sources = useImportSources();
  const [step, setStep] = useState<Step>("upload");
  const [sourceKey, setSourceKey] = useState<string>("");
  const [rawCsv, setRawCsv] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [updateExisting, setUpdateExisting] = useState(false);
  const [autoApprove, setAutoApprove] = useState(true);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const templates = useMappingTemplates(sourceKey || undefined);
  const saveTemplate = useSaveMappingTemplate();
  const deleteTemplate = useDeleteMappingTemplate();
  const commit = useCommitImport(divisionId, tournamentId);

  const selectedSource: ImportSourceInfo | undefined = sources.data?.find(
    (s) => s.key === sourceKey,
  );

  // ---- step 1: file upload ----

  const handleFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      setRawCsv(text);
      setFileName(file.name);
      if (!sourceKey) return;
      setDetecting(true);
      try {
        const res = await opsApi.detectColumns({ source: sourceKey, raw: text });
        setColumns(res.columns);
        setMapping(res.suggestedMapping ?? {});
        setStep("map");
      } catch (e) {
        toast.error(errorMessage(e, "Couldn't parse file"));
      } finally {
        setDetecting(false);
      }
    },
    [sourceKey],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const applyTemplate = (t: MappingTemplateView) => {
    setMapping(t.mapping);
  };

  // ---- step 2: column mapping ----

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const data = await opsApi.previewImport(divisionId, {
        source: sourceKey,
        raw: rawCsv,
        mapping,
        updateExisting: updateExisting,
        autoApprove: false,
      });
      setPreview(data);
      setStep("preview");
    } catch (e) {
      toast.error(errorMessage(e, "Preview failed"));
    } finally {
      setPreviewing(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !sourceKey) return;
    try {
      await saveTemplate.mutateAsync({ name: templateName.trim(), source: sourceKey, mapping });
      toast.success("Template saved");
      setShowSaveTemplate(false);
      setTemplateName("");
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't save template"));
    }
  };

  // ---- step 3: commit ----

  const handleCommit = () => {
    commit.mutate(
      {
        source: sourceKey,
        raw: rawCsv,
        mapping,
        updateExisting: updateExisting,
        autoApprove: autoApprove,
      },
      {
        onSuccess: (r) => {
          setResult(r);
          setStep("done");
          toast.success(`Import complete — ${r.imported} added, ${r.updated} updated`);
        },
        onError: (e) => {
          toast.error(errorMessage(e, "Import failed"));
        },
      },
    );
  };

  // ---- render ----

  if (sources.isLoading) return <Skeleton className="h-64 rounded-2xl" />;

  const d = embedded
    ? {
        root: "flex flex-col gap-4",
        stepBar: "flex items-center gap-2 text-sm text-white/40 select-none",
        stepActive: "text-white font-semibold",
        label: "text-white/70 text-xs font-mono uppercase tracking-widest",
        uploadIcon: "text-white/40",
        uploadText: "text-white/70",
        dropZone: (enabled: boolean) =>
          `flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${enabled ? "cursor-pointer hover:border-white/40 hover:bg-white/5" : "cursor-not-allowed opacity-40"} border-white/20`,
        selectTrigger: "border-white/20 bg-white/10 text-white",
        fieldLabel: "text-white/80",
        infoText: "text-white/50",
        templateBtn: "text-white/50 hover:text-white",
        templatePill: "border-white/20 bg-white/5 text-white",
        templateInput:
          "border border-white/20 bg-white/10 text-white placeholder:text-white/40 rounded-xl px-3 py-1.5 text-sm flex-1 max-w-xs outline-none focus:ring-2 focus:ring-candy",
        mapHeader: "text-sm font-medium text-white/80",
      }
    : {
        root: "flex flex-col gap-6",
        stepBar: "flex items-center gap-2 text-sm text-muted-foreground select-none",
        stepActive: "text-ink font-semibold",
        label: "",
        uploadIcon: "text-muted-foreground",
        uploadText: "text-muted-foreground",
        dropZone: (enabled: boolean) =>
          `flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${enabled ? "cursor-pointer hover:border-candy hover:bg-candy-tint" : "cursor-not-allowed opacity-50"} border-border`,
        selectTrigger: "max-w-xs",
        fieldLabel: "",
        infoText: "text-muted-foreground",
        templateBtn: "text-muted-foreground",
        templatePill: "border-border",
        templateInput:
          "border border-border rounded-xl px-3 py-1.5 text-sm flex-1 max-w-xs outline-none focus:ring-2 focus:ring-candy",
        mapHeader: "text-sm font-medium",
      };

  return (
    <div className={d.root}>
      {!embedded ? (
        <Button asChild tone="ghost" size="sm" className="text-muted-foreground -ml-2 self-start">
          <Link href={`/console/tournaments/${tournamentId}/players`}>
            <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
            Back to players
          </Link>
        </Button>
      ) : null}

      {!embedded ? (
        <PageHeader
          eyebrow="Import registrations"
          title="CSV Import"
          description="Upload a CSV export, map columns, preview rows, and commit to the division."
        />
      ) : null}

      {/* Steps */}
      <div className={d.stepBar}>
        {(["upload", "map", "preview", "done"] as Step[]).map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
            <span
              className={
                step === s
                  ? d.stepActive
                  : i < (["upload", "map", "preview", "done"] as Step[]).indexOf(step)
                    ? "text-mint"
                    : ""
              }
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          </span>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className={d.fieldLabel}>Import source</Label>
            <Select value={sourceKey} onValueChange={setSourceKey}>
              <SelectTrigger className={d.selectTrigger}>
                <SelectValue placeholder="Choose source…" />
              </SelectTrigger>
              <SelectContent>
                {sources.data?.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => sourceKey && fileRef.current?.click()}
            className={d.dropZone(!!sourceKey)}
          >
            {detecting ? (
              <Spinner />
            ) : (
              <>
                <Upload className={`h-8 w-8 ${d.uploadIcon}`} strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-medium">
                    {fileName || "Drop file here or click to browse"}
                  </p>
                  {!fileName && (
                    <p className={`mt-0.5 text-xs ${d.uploadText}`}>
                      {selectedSource ? selectedSource.label : "Select a source first"}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </div>
      )}

      {/* Step 2: Column mapping */}
      {step === "map" && selectedSource && (
        <div className="flex flex-col gap-6">
          {/* Saved templates */}
          {(templates.data?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-2">
              <p className={d.mapHeader}>Saved templates</p>
              <div className="flex flex-wrap gap-2">
                {templates.data?.map((t) => (
                  <div
                    key={t.id}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm ${d.templatePill}`}
                  >
                    <button
                      onClick={() => applyTemplate(t)}
                      className="hover:text-candy font-medium"
                    >
                      {t.name}
                    </button>
                    <button
                      onClick={() =>
                        deleteTemplate.mutate(t.id, {
                          onError: (e) => toast.error(errorMessage(e, "Couldn't delete")),
                        })
                      }
                      className="text-muted-foreground hover:text-pink"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Field mapping */}
          <div className="flex flex-col gap-3">
            <p className={d.mapHeader}>Map columns → fields</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {selectedSource.targetFields?.map((field: ImportFieldInfo) => (
                <div key={field.key} className="flex flex-col gap-1">
                  <Label className={d.fieldLabel}>
                    {field.label}
                    {field.required && <span className="text-pink ml-0.5">*</span>}
                  </Label>
                  <Select
                    value={mapping[field.key] ?? ""}
                    onValueChange={(v) =>
                      setMapping((prev) => {
                        const next = { ...prev };
                        if (v) next[field.key] = v;
                        else delete next[field.key];
                        return next;
                      })
                    }
                  >
                    <SelectTrigger className={d.selectTrigger}>
                      <SelectValue placeholder="— not mapped —" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="update-existing"
              checked={updateExisting}
              onCheckedChange={(v) => setUpdateExisting(!!v)}
            />
            <Label htmlFor="update-existing" className={d.fieldLabel}>
              Update existing registrations (matched by email)
            </Label>
          </div>

          {/* Save template */}
          <div className="flex flex-col gap-2">
            {showSaveTemplate ? (
              <div className="flex items-center gap-2">
                <input
                  className={d.templateInput}
                  placeholder="Template name…"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleSaveTemplate();
                    if (e.key === "Escape") setShowSaveTemplate(false);
                  }}
                />
                <Button
                  size="sm"
                  tone="paper"
                  onClick={() => void handleSaveTemplate()}
                  disabled={saveTemplate.isPending || !templateName.trim()}
                >
                  {saveTemplate.isPending ? <Spinner /> : "Save"}
                </Button>
                <Button size="sm" tone="ghost" onClick={() => setShowSaveTemplate(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                tone="ghost"
                className={`self-start ${d.templateBtn}`}
                onClick={() => setShowSaveTemplate(true)}
              >
                <BookMarked className="h-3.5 w-3.5" strokeWidth={2.25} />
                Save mapping as template
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button tone="paper" size="sm" onClick={() => setStep("upload")}>
              Back
            </Button>
            <Button
              tone="candy"
              size="sm"
              onClick={() => void handlePreview()}
              disabled={previewing}
            >
              {previewing ? <Spinner className="text-white" /> : null}
              Preview import
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === "preview" && preview && (
        <div className="flex flex-col gap-4">
          {/* Summary chips */}
          <div className="flex flex-wrap gap-2">
            <Badge tone="muted">{preview.summary.total} rows</Badge>
            {preview.summary.new > 0 && <Badge tone="mint">{preview.summary.new} new</Badge>}
            {preview.summary.update > 0 && (
              <Badge tone="candy">{preview.summary.update} updates</Badge>
            )}
            {preview.summary.duplicate > 0 && (
              <Badge tone="yellow">{preview.summary.duplicate} duplicates</Badge>
            )}
            {preview.summary.invalid > 0 && (
              <Badge tone="pink">{preview.summary.invalid} invalid</Badge>
            )}
          </div>

          <div className="border-border overflow-hidden rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Skill</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((row) => {
                  const meta = ROW_STATUS_META[row.status as keyof typeof ROW_STATUS_META] ?? {
                    label: row.status,
                    tone: "muted" as const,
                  };
                  return (
                    <TableRow key={row.rowNumber}>
                      <TableCell className="text-muted-foreground text-xs">
                        {row.rowNumber}
                      </TableCell>
                      <TableCell>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell>{row.values?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {row.values?.email ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm capitalize">
                        {row.values?.skillLevel ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs text-xs">
                        {row.messages?.join("; ")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {preview.summary.invalid > 0 && (
            <div className="border-yellow bg-yellow-tint flex items-start gap-2 rounded-2xl border-2 p-4 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
              <p className="text-black">
                {preview.summary.invalid} row{preview.summary.invalid !== 1 ? "s" : ""} will be
                skipped due to validation errors. Only new/update rows will be imported.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="auto-approve"
              checked={autoApprove}
              onCheckedChange={(v) => setAutoApprove(!!v)}
            />
            <Label htmlFor="auto-approve" className={d.fieldLabel}>
              Automatically approve imported registrations
            </Label>
          </div>

          <div className="flex gap-2">
            <Button tone="paper" size="sm" onClick={() => setStep("map")}>
              Back
            </Button>
            <Button
              tone="candy"
              size="sm"
              onClick={handleCommit}
              loading={commit.isPending}
              disabled={
                commit.isPending || (preview.summary.new === 0 && preview.summary.update === 0)
              }
            >
              {commit.isPending
                ? `Importing ${preview.summary.new + preview.summary.update} rows…`
                : `Import ${preview.summary.new + preview.summary.update} rows`}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === "done" && result && (
        <div className="flex flex-col items-center gap-6 py-10">
          <CheckCircle2 className="text-mint h-14 w-14" strokeWidth={1.5} />
          <div className="text-center">
            <p className="text-xl font-semibold">Import complete</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {result.imported} added · {result.updated} updated · {result.skipped} skipped
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild tone="paper" size="sm">
              <Link
                href={`/console/tournaments/${tournamentId}/divisions/${divisionId}/registrations`}
              >
                View registrations
              </Link>
            </Button>
            <Button
              tone="candy"
              size="sm"
              onClick={() => {
                setStep("upload");
                setRawCsv("");
                setFileName("");
                setColumns([]);
                setMapping({});
                setPreview(null);
                setResult(null);
              }}
            >
              Import another file
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
