-- Grouped form example — one table, four sections, one aligned grid.
--
-- sure-factor reads the `group:` line in each column comment and emits a spec
-- whose fields carry that group. The renderer turns each group into a section;
-- sure-ui lays the section out as a grid with shared label/control/message rows.
--
-- Write the grouping here, never in the page: this file is the input, and
-- `npm run generate` is the only edit step.

CREATE TABLE policy_intake (
  id UUID PRIMARY KEY,

  full_name        VARCHAR(100) NOT NULL,
  email            VARCHAR(255) NOT NULL,
  phone            VARCHAR(20),
  date_of_birth    DATE,

  coverage_type    VARCHAR(20) NOT NULL CHECK (coverage_type IN ('auto', 'home', 'life')),
  effective_on     DATE NOT NULL,
  term_months      SMALLINT NOT NULL,
  coverage_amount  NUMERIC(12,2) NOT NULL,
  deductible       NUMERIC(12,2) NOT NULL,

  billing_email    VARCHAR(255),
  payment_method   VARCHAR(20) CHECK (payment_method IN ('card', 'ach', 'check')),

  additional_insureds TEXT,
  notes               TEXT
);

COMMENT ON COLUMN policy_intake.full_name IS 'Full name
group: Applicant';
COMMENT ON COLUMN policy_intake.email IS 'Email
group: Applicant';
COMMENT ON COLUMN policy_intake.phone IS 'Phone
group: Applicant';
COMMENT ON COLUMN policy_intake.date_of_birth IS 'Date of birth
group: Applicant';

COMMENT ON COLUMN policy_intake.coverage_type IS 'Coverage type
group: Coverage';
COMMENT ON COLUMN policy_intake.effective_on IS 'Effective date
group: Coverage';
COMMENT ON COLUMN policy_intake.term_months IS 'Term, months
group: Coverage';
COMMENT ON COLUMN policy_intake.coverage_amount IS 'Coverage amount (total limit of liability)
group: Coverage';
COMMENT ON COLUMN policy_intake.deductible IS 'Deductible
group: Coverage';

COMMENT ON COLUMN policy_intake.billing_email IS 'Billing email
group: Billing';
COMMENT ON COLUMN policy_intake.payment_method IS 'Payment method
group: Billing';

COMMENT ON COLUMN policy_intake.additional_insureds IS 'Additional insureds
List names, one per line.
group: Additional';
COMMENT ON COLUMN policy_intake.notes IS 'Notes
group: Additional';
