-- Back up mft39_auth first. Apply once AFTER 001 and 002. No data is removed.
-- Existing ages are snapshots, NOT a reliable birth year: leave birth_year NULL.
ALTER TABLE users
  ADD first_name VARCHAR(80) NOT NULL DEFAULT '',
  ADD last_name VARCHAR(80) NOT NULL DEFAULT '',
  ADD middle_name VARCHAR(80) NOT NULL DEFAULT '',
  ADD display_name VARCHAR(250) NOT NULL DEFAULT 'Участник MFT39',
  ADD profile_initialized_at DATETIME NULL,
  ADD profile_edited_at DATETIME NULL,
  ADD hall_scope ENUM('all','assigned') NOT NULL DEFAULT 'all',
  ADD version INT UNSIGNED NOT NULL DEFAULT 1,
  ADD KEY users_role_status(role,status);

ALTER TABLE club_halls ADD version INT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE club_students
  ADD birth_year SMALLINT UNSIGNED NULL,
  ADD archived_at DATETIME NULL,
  ADD archived_by BIGINT UNSIGNED NULL,
  ADD archive_reason VARCHAR(500) NULL,
  ADD KEY students_archive(archived_at,hall_id),
  ADD CONSTRAINT students_archived_by FOREIGN KEY(archived_by) REFERENCES users(id),
  ADD CONSTRAINT students_birth_year CHECK(birth_year IS NULL OR birth_year BETWEEN 1900 AND 2199);
ALTER TABLE club_application_batches ADD revoked_at DATETIME NULL;
ALTER TABLE club_audit ADD KEY audit_actor_created(actor_user_id,created_at,id), ADD KEY audit_created(created_at,id), ADD KEY audit_entity(entity_id,action);

CREATE TABLE club_user_permissions (
  user_id BIGINT UNSIGNED NOT NULL,
  permission VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  allowed BOOLEAN NOT NULL,
  PRIMARY KEY(user_id,permission),
  FOREIGN KEY(user_id) REFERENCES users(id),
  CHECK(permission IN ('applications.decide','students.status','payments.write','students.archive','students.restore'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Serializes access changes and mutations, including last-admin protection.
CREATE TABLE club_access_lock(id TINYINT UNSIGNED PRIMARY KEY);
INSERT INTO club_access_lock VALUES(1);
UPDATE club_schema_version SET version=3 WHERE id=1;
