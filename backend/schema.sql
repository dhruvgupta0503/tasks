DROP TABLE IF EXISTS users;
CREATE TABLE users (
  email TEXT PRIMARY KEY,
  password TEXT NOT NULL
);

DROP TABLE IF EXISTS tasks;
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 5),
  status TEXT NOT NULL CHECK (status IN ('pending', 'finished')),
  user_id TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(email)
);
