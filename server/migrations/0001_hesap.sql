-- Hesaplar ve buluttaki kayıtlar.
-- users.rev: kullanıcının belge sayacı; her eşitleme yazısında bir artar, belgeler hangi sayaçta yazıldığını taşır.
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  rev INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL
);

-- E-posta ile gelen tek kullanımlık kod. hash = sha256(e-posta:kod).
CREATE TABLE otps (
  email TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  exp INTEGER NOT NULL,
  tries INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL
);

-- Oturumlar. Belirtecin kendisi saklanmaz, sha256'sı saklanır.
CREATE TABLE sessions (
  hash TEXT PRIMARY KEY,
  uid INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created INTEGER NOT NULL,
  seen INTEGER NOT NULL
);
CREATE INDEX sessions_uid ON sessions(uid);

-- Belgeler: d:<gün>, f:<gıda>, o:<alan>, c:<sohbet>, p (program), cfg (ayarlar). v NULL ise silinmiş.
CREATE TABLE docs (
  uid INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  k TEXT NOT NULL,
  v TEXT,
  ts INTEGER NOT NULL,
  PRIMARY KEY (uid, k)
);
CREATE INDEX docs_ts ON docs(uid, ts);
