export interface AcademicYearOption {
  id: string;
  label: string;
  isCurrent: boolean;
  startsOn: string;
  endsOn: string;
}

export interface BranchOption {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface ResolvedYearBranch {
  year: AcademicYearOption;
  branch: "all" | string;
}

export function resolveYearAndBranch(
  params: { year?: string; branch?: string },
  years: AcademicYearOption[],
  branches: BranchOption[],
): ResolvedYearBranch {
  if (years.length === 0) {
    throw new Error("resolveYearAndBranch requires at least one academic year");
  }

  const matchedYear = years.find((year) => year.label === params.year);
  const currentYear = years.find((year) => year.isCurrent);
  const year = matchedYear ?? currentYear ?? years[0]!;

  const matchedBranch = branches.find(
    (branch) => branch.code === params.branch,
  );
  const branch =
    params.branch === "all" ? "all" : (matchedBranch?.code ?? "all");

  return { year, branch };
}
