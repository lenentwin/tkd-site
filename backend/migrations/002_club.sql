-- Apply once in the existing mft39_auth database AFTER 001_auth.sql.
-- Additive migration. Back up first; MySQL DDL is not transactionally reversible.
ALTER TABLE users MODIFY role ENUM('user','trainer','head_trainer','admin') NOT NULL DEFAULT 'user';

CREATE TABLE club_halls (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  name VARCHAR(200) NOT NULL, address VARCHAR(300) NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO club_halls (id,name,address) VALUES
 ('chelnokova','Центр развития тхэквондо МФТ','Калининград, улица Генерала Челнокова, 43'),
 ('city','Центр тхэквондо МФТ, ТЦ «Сити»','ТЦ «Сити», Калининград'),
 ('school10','Школа №10','Калининград, улица Войнич, 1');

CREATE TABLE club_trainer_halls (
  user_id BIGINT UNSIGNED NOT NULL, hall_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  assigned_at DATETIME NOT NULL, PRIMARY KEY(user_id,hall_id), KEY trainer_hall(hall_id),
  FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(hall_id) REFERENCES club_halls(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE club_students (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  hall_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  last_name VARCHAR(80) NOT NULL, first_name VARCHAR(80) NOT NULL, middle_name VARCHAR(80) NOT NULL DEFAULT '',
  age TINYINT UNSIGNED NOT NULL, age_recorded_on DATE NOT NULL,
  learning_status ENUM('trial','permanent','inactive') NOT NULL DEFAULT 'trial',
  admitted_at DATETIME NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  KEY students_hall_status(hall_id,learning_status,admitted_at),
  FOREIGN KEY(hall_id) REFERENCES club_halls(id), CHECK(age BETWEEN 1 AND 120)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE club_student_guardians (
  student_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, user_id BIGINT UNSIGNED NOT NULL,
  relationship ENUM('self','parent','guardian') NOT NULL, created_at DATETIME NOT NULL,
  PRIMARY KEY(student_id,user_id), KEY guardian_students(user_id,student_id),
  FOREIGN KEY(student_id) REFERENCES club_students(id), FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE club_application_batches (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  applicant_id BIGINT UNSIGNED NOT NULL, idempotency_key VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, created_at DATETIME NOT NULL,
  consent_version VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, consented_at DATETIME NOT NULL,
  UNIQUE KEY application_idempotency(applicant_id,idempotency_key), FOREIGN KEY(applicant_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE club_applications (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  batch_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  student_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  applicant_id BIGINT UNSIGNED NOT NULL, hall_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  requested_date DATE NOT NULL, comment VARCHAR(1000) NOT NULL DEFAULT '', representative_json JSON NULL,
  status ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending', version INT UNSIGNED NOT NULL DEFAULT 1,
  decided_by BIGINT UNSIGNED NULL, decided_at DATETIME NULL, created_at DATETIME NOT NULL,
  UNIQUE KEY application_duplicate(student_id,hall_id,requested_date),
  KEY application_queue(hall_id,status,created_at), KEY applicant_applications(applicant_id,created_at),
  FOREIGN KEY(batch_id) REFERENCES club_application_batches(id), FOREIGN KEY(student_id) REFERENCES club_students(id),
  FOREIGN KEY(applicant_id) REFERENCES users(id), FOREIGN KEY(hall_id) REFERENCES club_halls(id), FOREIGN KEY(decided_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE club_payments (
  student_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, month DATE NOT NULL,
  status ENUM('paid','unpaid') NOT NULL DEFAULT 'unpaid', version INT UNSIGNED NOT NULL DEFAULT 1,
  confirmed_by BIGINT UNSIGNED NULL, confirmed_at DATETIME NULL, updated_by BIGINT UNSIGNED NOT NULL, updated_at DATETIME NOT NULL,
  PRIMARY KEY(student_id,month), KEY payments_month(month,status),
  FOREIGN KEY(student_id) REFERENCES club_students(id), FOREIGN KEY(confirmed_by) REFERENCES users(id),
  FOREIGN KEY(updated_by) REFERENCES users(id), CHECK(DAYOFMONTH(month)=1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE club_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  hall_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL, actor_user_id BIGINT UNSIGNED NULL,
  action VARCHAR(40) CHARACTER SET ascii NOT NULL, entity_id VARCHAR(80) CHARACTER SET ascii NOT NULL,
  details_json JSON NOT NULL, created_at DATETIME NOT NULL,
  KEY student_history(student_id,id), KEY hall_changes(hall_id,id),
  FOREIGN KEY(student_id) REFERENCES club_students(id), FOREIGN KEY(hall_id) REFERENCES club_halls(id), FOREIGN KEY(actor_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE club_device_tokens (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL, label VARCHAR(80) NOT NULL,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL, expires_at BIGINT UNSIGNED NOT NULL, revoked_at BIGINT UNSIGNED NULL,
  UNIQUE KEY device_token_hash(token_hash), KEY user_devices(user_id,revoked_at), FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE club_schema_version (id TINYINT PRIMARY KEY, version INT NOT NULL);
INSERT INTO club_schema_version VALUES(1,2);
