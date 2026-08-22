-- Nothing previously enforced that only one academic_year row can be
-- current — a careless manual UPDATE could leave two (or zero) rows
-- flagged, and resolve-year-branch.ts just picks .find(isCurrent), silently
-- using whichever comes first. A partial unique index makes "at most one
-- current year" a database guarantee instead of a convention.
create unique index academic_year_one_current
  on academic_year (is_current)
  where is_current;
