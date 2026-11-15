-- Apply once after 003, following a verified backup of mft39_auth.
-- Additive only. No historical confirmations are fabricated or backfilled.
CREATE TABLE legal_acceptances (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  document_type ENUM('terms','user_consent','guardian_consent') NOT NULL,
  document_version VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  document_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  subject_key VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  application_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  student_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  confirmed_at DATETIME NOT NULL,
  UNIQUE KEY acceptance_once(user_id,document_type,document_version,document_hash,subject_key),
  KEY acceptance_application(application_id),
  KEY acceptance_student(student_id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(application_id) REFERENCES club_applications(id) ON DELETE CASCADE,
  FOREIGN KEY(student_id) REFERENCES club_students(id) ON DELETE CASCADE,
  CONSTRAINT legal_subject CHECK(
    (document_type='guardian_consent' AND application_id IS NOT NULL AND student_id IS NOT NULL AND subject_key=application_id)
    OR (document_type IN ('terms','user_consent') AND application_id IS NULL AND student_id IS NULL AND subject_key='account')
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Separate migration marker preserves the existing schemaVersion3 API contract.
CREATE TABLE legal_schema_version(id TINYINT UNSIGNED PRIMARY KEY, version INT UNSIGNED NOT NULL);
INSERT INTO legal_schema_version VALUES(1,1);
