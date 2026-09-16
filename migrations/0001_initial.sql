CREATE TABLE titles (id TEXT PRIMARY KEY, title TEXT NOT NULL, kind TEXT NOT NULL, format TEXT NOT NULL, year INTEGER NOT NULL, runtime INTEGER NOT NULL, genre TEXT NOT NULL, language TEXT NOT NULL, energy TEXT NOT NULL, data TEXT NOT NULL);
CREATE INDEX idx_titles_filters ON titles(kind, year);
CREATE TABLE sessions (id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, region TEXT NOT NULL DEFAULT 'ae', arc TEXT NOT NULL DEFAULT '{}', expires INTEGER NOT NULL, window INTEGER NOT NULL DEFAULT 0, requests INTEGER NOT NULL DEFAULT 0);
CREATE INDEX idx_sessions_expiry ON sessions(expires);
CREATE TABLE entries (session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, title_id TEXT NOT NULL REFERENCES titles(id), status TEXT NOT NULL CHECK(status IN ('saved','watched','hidden')), rating INTEGER NOT NULL DEFAULT 0 CHECK(rating BETWEEN 0 AND 5), updated INTEGER NOT NULL, PRIMARY KEY(session_id,title_id));
