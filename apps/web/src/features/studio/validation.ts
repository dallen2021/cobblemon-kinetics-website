export interface SquirtleEditorValues {
  machineId: string;
  jobId: string;
  efficiency: number;
  publicRationale: string;
  privateNote: string;
}

export interface ValidationIssue {
  field: keyof SquirtleEditorValues;
  message: string;
}

const allowedMachine = "cobblemon_kinetics:hydro_coupler";
const allowedJob = "cobblemon_kinetics:hydro_operator";

export function validateSquirtleEditor(values: SquirtleEditorValues): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (values.machineId !== allowedMachine) {
    issues.push({
      field: "machineId",
      message: "Select the versioned Hydro Coupler registry entry.",
    });
  }
  if (values.jobId !== allowedJob) {
    issues.push({
      field: "jobId",
      message: "The first slice supports only the Hydro Operator job.",
    });
  }
  if (!Number.isFinite(values.efficiency) || values.efficiency < 0.25 || values.efficiency > 2) {
    issues.push({ field: "efficiency", message: "Efficiency must be between 0.25× and 2.00×." });
  }
  if (values.publicRationale.trim().length < 20) {
    issues.push({
      field: "publicRationale",
      message: "Add at least 20 characters of public balance rationale.",
    });
  }
  if (values.privateNote.length > 2_000) {
    issues.push({
      field: "privateNote",
      message: "Private notes are limited to 2,000 characters.",
    });
  }
  return issues;
}
