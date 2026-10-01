// The whole database this example needs. Two tables, written the way you
// would write them in a real migration.
//
// Nothing below is read by hand anywhere else in this example — sure-factor
// reads this file and decides the field names, the types, the validation
// rules and the help text.

CREATE TABLE subscribers (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  plan VARCHAR(40) NOT NULL,
  signup_date DATE NOT NULL,
  notes TEXT
);

CREATE TABLE invitations (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  invited_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ
);