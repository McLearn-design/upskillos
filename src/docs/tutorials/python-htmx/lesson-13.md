# Lesson 13: Schema Design — Relationships, Foreign Keys, Indexes, and Migrations

**What you will build**
A relational schema models real-world entities and their relationships. Foreign keys enforce referential integrity (you cannot have a note without a user). Indexes trade write overhead for read speed. Schema migrations are versioned changes to a live database — never ALTER a production table without a migration plan.

**What you need to know first**
- Nothing

**Terms used in this lesson**
- **Foreign Key** — a constraint that ensures a value in one table matches a primary key in another table. It solves the problem of orphaned records by preventing you from inserting a record that points to a non-existent entity.
- **Referential Integrity** — the state of a database where all foreign key relationships are valid. It exists to guarantee that relationships between data remain consistent.
- **Index** — a data structure that improves the speed of data retrieval operations. It exists to avoid full table scans, trading write speed for read speed.
- **Schema Migration** — a versioned change to a database schema. It exists to safely alter a live database's structure over time without manual, ad-hoc changes.

**Objects and methods used**
- **sqlite3.connect**
  - *What it is:* A function to open a connection to an SQLite database.
  - *Implementation:* `def connect(database: str | bytes | PathLike[str] | PathLike[bytes], ...) -> Connection`
  - *Its use:* Used to open an in-memory database for our throwaway examples.
  - *Type:* Function
  - *Responsibility:* Establishes and manages the connection to the SQLite engine.
  - *Depends on:* A database file path or `':memory:'`.
  - *Connects to:* SQLite C library, returning a `Connection` object.
  - *Shape:* A factory method that serves as the entry point to the `sqlite3` module.
- **Connection.execute**
  - *What it is:* A method to execute a single SQL statement.
  - *Implementation:* `def execute(self, sql: str, parameters: Iterable[Any] = ()) -> Cursor`
  - *Its use:* Used to run `CREATE TABLE`, `INSERT`, and `SELECT` queries.
  - *Type:* Instance method
  - *Responsibility:* Prepares and executes a SQL query on the database.
  - *Depends on:* An active `Connection` and a valid SQL string.
  - *Connects to:* The database engine, modifying data or returning a `Cursor`.
  - *Shape:* A standard API for issuing direct commands to the database.
- **Connection.executescript**
  - *What it is:* A method to execute multiple SQL statements at once.
  - *Implementation:* `def executescript(self, sql_script: str) -> Cursor`
  - *Its use:* Used to run multi-statement schema setups (like creating multiple tables).
  - *Type:* Instance method
  - *Responsibility:* Executes a script containing multiple semicolons-separated SQL statements.
  - *Depends on:* An active `Connection` and a string containing multiple SQL commands.
  - *Connects to:* The database engine to apply batched changes.
  - *Shape:* A convenience API for running large blocks of SQL at once.
- **Connection.executemany**
  - *What it is:* A method to execute a SQL command against all parameter sequences or mappings found in the sequence.
  - *Implementation:* `def executemany(self, sql: str, parameters: Iterable[Iterable[Any]]) -> Cursor`
  - *Its use:* Used to insert multiple rows efficiently.
  - *Type:* Instance method
  - *Responsibility:* Prepares a single SQL statement and executes it for every item in a sequence.
  - *Depends on:* An active `Connection`, a parameterized SQL string, and a sequence of data tuples.
  - *Connects to:* The database engine, issuing batch inserts.
  - *Shape:* An optimization boundary for bulk data manipulation.

## Concept Unit: One-to-many relationships

### The Problem
How do we represent a relationship where one user has many notes, ensuring that notes always belong to a valid user? What happens to the notes if the user is deleted? If we don't enforce this at the database level, our application might query notes for users that no longer exist, causing crashes or phantom data.

### Introduce the concept in isolation
We will use an in-memory SQLite database to demonstrate how foreign keys enforce a one-to-many relationship.

```python
import sqlite3
con = sqlite3.connect(':memory:')
con.execute('PRAGMA foreign_keys = ON')
con.executescript('''
    CREATE TABLE users (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT    NOT NULL UNIQUE,
        email    TEXT    NOT NULL
    );
    CREATE TABLE notes (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title   TEXT    NOT NULL,
        body    TEXT    DEFAULT ''
    );
''')
con.row_factory = sqlite3.Row
# Insert a user:
con.execute('INSERT INTO users (username, email) VALUES (?,?)', ('alice','alice@example.com'))
# Get the new user's id:
alice_id = con.execute('SELECT last_insert_rowid()').fetchone()[0]
# Insert notes for alice:
con.executemany('INSERT INTO notes (user_id, title, body) VALUES (?,?,?)', [
    (alice_id, 'First note',  'Hello world'),
    (alice_id, 'Second note', 'SQLite is great'),
])
con.commit()
# JOIN query: get alice's notes with username
rows = con.execute('SELECT n.id, n.title, u.username FROM notes n JOIN users u ON n.user_id=u.id').fetchall()
for r in rows: print(dict(r))
```

Output:
```
{'id': 1, 'title': 'First note', 'username': 'alice'}
{'id': 2, 'title': 'Second note', 'username': 'alice'}
```
This proves that the foreign key successfully linked the notes to the user, and the JOIN query correctly brought the data back together. The `REFERENCES users(id) ON DELETE CASCADE` ensures that when alice (id=1) is deleted, all her notes are automatically deleted. `PRAGMA foreign_keys=ON` is required for SQLite to enforce these FK constraints. `last_insert_rowid()` returns the id of the most recently inserted row. `JOIN notes n ON n.user_id=u.id` combines rows from both tables where the `user_id` matches.

### Discard the throwaway
This throwaway lab is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are initializing our core data model.
- **Files affected:** `schema.sql` (created)
- **Change type:** add
- **Location:** New file.
- **Dependencies:** SQLite.

### The New Code
```sql
CREATE TABLE users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT    NOT NULL UNIQUE,
    email    TEXT    NOT NULL
);

CREATE TABLE notes (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title   TEXT    NOT NULL,
    body    TEXT    DEFAULT ''
);
```

### The Updated Project
```sql
1 CREATE TABLE users (
2     id       INTEGER PRIMARY KEY AUTOINCREMENT,
3     username TEXT    NOT NULL UNIQUE,
4     email    TEXT    NOT NULL
5 );
6 
7 CREATE TABLE notes (
8     id      INTEGER PRIMARY KEY AUTOINCREMENT,
9     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
10    title   TEXT    NOT NULL,
11    body    TEXT    DEFAULT ''
12 );
```
This creates the foundational schema representing our core entities.

### Mechanical walkthrough
- `CREATE TABLE users`: Defines a new table named users with primary key and unique constraints.
- `CREATE TABLE notes`: Defines the dependent table for notes.
- `REFERENCES users(id)`: Establishes the foreign key, requiring that every `user_id` in the `notes` table corresponds to a valid `id` in the `users` table.
- `ON DELETE CASCADE`: Specifies that if a parent record in `users` is removed, all dependent records in `notes` should automatically be removed as well.

### CS lens
Relational algebra underpins SQL databases. A one-to-many relationship is a fundamental mapping that avoids data duplication (normalization) by storing the parent data once and linking to it via identifiers.

### SE lens
Using database-level constraints like foreign keys ensures data integrity at the lowest level. If application logic fails or a bug occurs, the database will refuse to create orphaned records or leave dangling data on deletion.

### Commands needed
Run: python app.py

### Run it
The SQLite database schema is defined and ready for use.

### One sentence connecting to previous unit
With a one-to-many relationship understood, we can move on to representing more complex scenarios where an item can belong to multiple categories at once.

## Concept Unit: Many-to-many relationships (join table)

### The Problem
How do we model tags for notes, where one note can have many tags, and one tag can be applied to many notes? A simple foreign key on either table would limit us to a one-to-many relationship.

### Introduce the concept in isolation
We solve this by creating a "join table" that sits between the notes and tags tables, containing foreign keys to both.

```python
import sqlite3
con = sqlite3.connect(':memory:')
con.execute('PRAGMA foreign_keys = ON')
con.executescript('''
    CREATE TABLE notes (
        id    INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL
    );
    CREATE TABLE tags (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    );
    -- Join table: a note can have many tags, a tag can belong to many notes
    CREATE TABLE note_tags (
        note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
        PRIMARY KEY (note_id, tag_id)  -- composite PK prevents duplicates
    );
''')
con.executemany('INSERT INTO notes (title) VALUES (?)', [('Python',),('Flask',),('SQLite',)])
con.executemany('INSERT INTO tags (name) VALUES (?)', [('backend',),('database',),('web',)])
# Tag note 1 (Python) with 'backend' and 'web':
con.executemany('INSERT INTO note_tags VALUES (?,?)', [(1,1),(1,3),(2,3),(3,1),(3,2)])
con.commit()
con.row_factory = sqlite3.Row
# All tags for note 1:
rows = con.execute('SELECT t.name FROM tags t JOIN note_tags nt ON t.id=nt.tag_id WHERE nt.note_id=1').fetchall()
print('Tags for note 1:', [r['name'] for r in rows])
```

Output:
```
Tags for note 1: ['backend', 'web']
```
This proves that a single note can be associated with multiple tags through the join table `note_tags`. The join table `note_tags` has no id of its own; `PRIMARY KEY (note_id, tag_id)` is a composite primary key that prevents the exact same tag from being applied twice to the identical note. The query traverses the join table to return the actual tag names. The `notes` and `tags` tables remain conceptually independent, while the relationship itself is fully encapsulated in `note_tags`.

### Discard the throwaway
This throwaway lab is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are continuing schema setup.
- **Files affected:** `schema.sql` (modified)
- **Change type:** add
- **Location:** Appended to the end of the file.
- **Dependencies:** None.

### The New Code
```sql
CREATE TABLE tags (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE note_tags (
    note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);
```

### The Updated Project
```sql
12 );
13 
14 CREATE TABLE tags ( // ← new
15     id   INTEGER PRIMARY KEY AUTOINCREMENT, // ← new
16     name TEXT NOT NULL UNIQUE // ← new
17 ); // ← new
18 
19 CREATE TABLE note_tags ( // ← new
20     note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE, // ← new
21     tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE, // ← new
22     PRIMARY KEY (note_id, tag_id) // ← new
23 ); // ← new
```
This adds the many-to-many tagging capability to our database model.

### Mechanical walkthrough
- `CREATE TABLE tags`: Defines a table for the unique tags available in the system.
- `CREATE TABLE note_tags`: Defines the join table linking `notes` and `tags`.
- `REFERENCES notes(id)`: The first foreign key linking back to the notes table.
- `REFERENCES tags(id)`: The second foreign key linking back to the tags table.
- `PRIMARY KEY (note_id, tag_id)`: A composite primary key that ensures a note cannot be tagged with the exact same tag more than once.

### CS lens
A many-to-many relationship represents a bipartite graph where edges are stored in an associative entity (the join table). This normalization prevents redundancy and allows queries to easily traverse from either direction (all tags for a note, or all notes for a tag).

### SE lens
Using composite primary keys in a join table is a critical pattern. It guards against accidental duplicate inserts, which can happen if network retries cause a form to submit twice.

### Commands needed
Run: python app.py

### Run it
Our tagging schema is complete and robust.

### One sentence connecting to previous unit
As our data grows, basic relationships remain sound, but the queries across them will slow down unless we optimize access paths.

## Concept Unit: Indexes — trading write speed for read speed

### The Problem
When querying a large dataset (like checking all events for a specific user), the database by default must read every single row in the table to see if it matches. How do we speed this up when the table grows to millions of rows?

### Introduce the concept in isolation
We introduce indexes, which create a separate data structure designed for fast lookups.

```python
import sqlite3, time, random, string
con = sqlite3.connect(':memory:')
con.execute('CREATE TABLE events (id INTEGER PRIMARY KEY, user_id INTEGER, event_type TEXT, created TEXT)')
# Insert 50,000 rows:
rows = [(i, random.randint(1,100), random.choice(['login','logout','purchase']),
         f'2024-{random.randint(1,12):02d}-{random.randint(1,28):02d}') for i in range(50000)]
con.executemany('INSERT INTO events VALUES (?,?,?,?)', rows)
con.commit()
# Query WITHOUT index:
start = time.perf_counter()
result = con.execute('SELECT COUNT(*) FROM events WHERE user_id=42').fetchone()[0]
no_idx = time.perf_counter() - start
print(f'Without index: {result} events in {no_idx*1000:.2f}ms')
# Add index on user_id:
con.execute('CREATE INDEX idx_events_user_id ON events(user_id)')
start = time.perf_counter()
result = con.execute('SELECT COUNT(*) FROM events WHERE user_id=42').fetchone()[0]
with_idx = time.perf_counter() - start
print(f'With index:    {result} events in {with_idx*1000:.2f}ms')
print(f'Speedup: {no_idx/with_idx:.1f}x')
```

Output:
```
Without index: 492 events in 3.42ms
With index:    492 events in 0.15ms
Speedup: 22.8x
```
This proves that the index dramatically speeds up retrieval time. Without the index, a full table scan is performed, reading all 50,000 rows to check `user_id`. With the index, SQLite uses a B-tree structure on `user_id`, finding `user_id=42` in `O(log n)` time and jumping directly to matching rows. The cost is that every `INSERT`, `UPDATE`, or `DELETE` on the `user_id` column must now also update the B-tree.

### Discard the throwaway
This throwaway lab is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition to optimize queries.
- **Files affected:** `schema.sql` (modified)
- **Change type:** add
- **Location:** Appended to the end of the file.
- **Dependencies:** None.

### The New Code
```sql
CREATE INDEX idx_notes_user_id ON notes(user_id);
```

### The Updated Project
```sql
22     PRIMARY KEY (note_id, tag_id)
23 );
24 
25 CREATE INDEX idx_notes_user_id ON notes(user_id); // ← new
```
This adds an index to the `user_id` column of the `notes` table to speed up retrieving a specific user's notes.

### Mechanical walkthrough
- `CREATE INDEX idx_notes_user_id`: Instructs the database to create a new index named `idx_notes_user_id`.
- `ON notes(user_id)`: Specifies that the index should be built on the `user_id` column of the `notes` table.

### CS lens
Indexes are typically implemented as B-trees (or variants like B+ trees). They turn an `O(N)` linear search into an `O(log N)` tree traversal, making read operations immensely faster at the expense of storage space and a small constant factor of overhead during writes.

### SE lens
You shouldn't index every column. The trade-off is clear: you are spending write throughput and storage capacity to buy read latency. Only index columns that are frequently used in `WHERE` clauses, `JOIN` conditions, or `ORDER BY` operations.

### Commands needed
Run: python app.py

### Run it
The index is now part of the schema and will automatically optimize relevant queries.

### One sentence connecting to previous unit
Indexes provide a massive performance boost, but verifying that the database engine is actually using them requires a specialized diagnostic tool.

## Concept Unit: EXPLAIN QUERY PLAN — understanding what SQLite does

### The Problem
We've added an index, but how do we definitively know the database is actually using it instead of doing a full table scan?

### Introduce the concept in isolation
We can use `EXPLAIN QUERY PLAN` to ask SQLite exactly how it intends to execute a given query.

```python
import sqlite3
con = sqlite3.connect(':memory:')
con.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, email TEXT)')
con.execute('CREATE TABLE notes (id INTEGER PRIMARY KEY, user_id INTEGER, title TEXT)')
con.executemany('INSERT INTO users VALUES (?,?,?)', [(i,f'user{i}',f'u{i}@x.com') for i in range(1,101)])
con.executemany('INSERT INTO notes VALUES (?,?,?)', [(i,(i%100)+1,f'Note {i}') for i in range(1,501)])
# Without index on notes.user_id:
plan = con.execute('EXPLAIN QUERY PLAN SELECT * FROM notes WHERE user_id=5').fetchall()
print('No index plan:')
for p in plan: print(' ', p)
# Add index:
con.execute('CREATE INDEX idx_notes_user ON notes(user_id)')
plan2 = con.execute('EXPLAIN QUERY PLAN SELECT * FROM notes WHERE user_id=5').fetchall()
print('With index plan:')
for p in plan2: print(' ', p)
print('SCAN TABLE: full table scan. SEARCH USING INDEX: O(log n) lookup.')
```

Output:
```
No index plan:
  (2, 0, 0, 'SCAN TABLE notes')
With index plan:
  (3, 0, 0, 'SEARCH TABLE notes USING INDEX idx_notes_user (user_id=?)')
SCAN TABLE: full table scan. SEARCH USING INDEX: O(log n) lookup.
```
This proves the difference in execution strategy. Without the index, `EXPLAIN` shows a `SCAN TABLE notes` operation, meaning it reads every row. After creating the index `idx_notes_user`, `EXPLAIN` shows `SEARCH TABLE notes USING INDEX idx_notes_user (user_id=?)`, confirming that the B-tree is being used. A general rule: any column frequently used in `WHERE`, `JOIN ON`, or `ORDER BY` on large tables should be indexed. Primary keys are automatically indexed, and `UNIQUE` constraints create implicit indexes.

### Discard the throwaway
This throwaway lab is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a diagnostic pattern used outside the core schema.
- **Files affected:** None
- **Change type:** none
- **Location:** N/A
- **Dependencies:** None.

### The New Code
```sql
EXPLAIN QUERY PLAN SELECT * FROM notes WHERE user_id=5;
```

### The Updated Project
(No file modified. The diagnostic query above is run against the active database to verify the `idx_notes_user_id` index is active).

### Mechanical walkthrough
- `EXPLAIN QUERY PLAN`: A prefix command that instructs SQLite not to run the query, but to return a description of the operations it *would* use to resolve it.
- `SELECT * FROM notes WHERE user_id=5`: The actual query we are testing.

### CS lens
Query planners are sophisticated state machines that estimate costs for different execution paths. They consider table size, available indexes, and data distribution to choose the most efficient path.

### SE lens
Always verify your assumptions about performance. A missing index can cause an application to fail under load in production, even if it performed perfectly in local development with a small dataset. `EXPLAIN` provides the observability needed to confirm optimization.

### Commands needed
Run: python app.py

### Run it
The query plan confirms our index is working as intended.

### One sentence connecting to previous unit
Defining a schema and tuning it with indexes works well for a new database, but eventually, live production databases need their schemas changed without losing existing data.

## Concept Unit: Schema migrations — versioned changes

### The Problem
Once an application is deployed, you cannot simply drop and recreate the database when you want to add a new column. Doing so would destroy all user data. How do we safely apply schema changes over time?

### Introduce the concept in isolation
We solve this using schema migrations — tracking which structural changes have been applied to the database, and only executing new ones.

```python
import sqlite3
# Simple migration pattern: version table tracks applied migrations
con = sqlite3.connect(':memory:')
con.execute('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied TEXT DEFAULT (datetime("now")))')
# Define migrations as ordered functions:
def migration_001(db):
    db.execute('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE)')
    print('001: created users table')
def migration_002(db):
    db.execute('ALTER TABLE users ADD COLUMN email TEXT DEFAULT ""')
    print('002: added email column to users')
def migration_003(db):
    db.execute('CREATE INDEX idx_users_email ON users(email)')
    print('003: added email index')
MIGRATIONS = [(1, migration_001), (2, migration_002), (3, migration_003)]
def run_migrations(db):
    applied = {row[0] for row in db.execute('SELECT version FROM schema_migrations').fetchall()}
    for version, fn in MIGRATIONS:
        if version not in applied:
            fn(db)
            db.execute('INSERT INTO schema_migrations (version) VALUES (?)', (version,))
            db.commit()
run_migrations(con)
print('Applied versions:', con.execute('SELECT version FROM schema_migrations').fetchall())
```

Output:
```
001: created users table
002: added email column to users
003: added email index
Applied versions: [(1,), (2,), (3,)]
```
This proves that the migration script records state. On the first run, `applied` is empty, so all three migrations run. If we ran it again, the `applied` set would contain `{1, 2, 3}`, and the script would skip them all. If we added `migration_004`, only `004` would run. This exact pattern is what mature tools like Flask-Migrate, Alembic, and Flyway implement under the hood.

### Discard the throwaway
This throwaway lab is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch script for database maintenance.
- **Files affected:** `migrate.py` (created)
- **Change type:** add
- **Location:** New file at project root.
- **Dependencies:** SQLite.

### The New Code
```python
import sqlite3

def run_migrations():
    db = sqlite3.connect('app.db')
    db.execute('''
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY, 
            applied TEXT DEFAULT (datetime("now"))
        )
    ''')
    # Future migrations will be added here
    db.commit()
    db.close()

if __name__ == '__main__':
    run_migrations()
```

### The Updated Project
```python
1 import sqlite3 // ← new
2  // ← new
3 def run_migrations(): // ← new
4     db = sqlite3.connect('app.db') // ← new
5     db.execute(''' // ← new
6         CREATE TABLE IF NOT EXISTS schema_migrations ( // ← new
7             version INTEGER PRIMARY KEY,  // ← new
8             applied TEXT DEFAULT (datetime("now")) // ← new
9         ) // ← new
10    ''') // ← new
11    # Future migrations will be added here // ← new
12    db.commit() // ← new
13    db.close() // ← new
14  // ← new
15 if __name__ == '__main__': // ← new
16    run_migrations() // ← new
```
This gives us a foundation for tracking and applying schema changes iteratively as the project matures.

### Mechanical walkthrough
- `CREATE TABLE IF NOT EXISTS schema_migrations`: A defensive query that creates the tracking table only if it doesn't already exist.
- `version INTEGER PRIMARY KEY`: The column that records which migration steps have successfully completed.

### CS lens
Migrations represent a state machine where the database schema is the state, and the migration scripts are the transition functions. Tracking the current version allows a system to correctly replay the necessary transitions to reach the desired target state.

### SE lens
Never manually `ALTER` a production table. Migrations ensure that all environments (local, staging, production) can be deterministically updated using the exact same script stored in version control.

### Commands needed
Run: python app.py

### Run it
The migration base system is set up and will prevent ad-hoc schema drift.

### One sentence connecting to previous unit
The schema gives data shape and structure, which we can now securely expose and manipulate via the application logic.

## Closing

### Connect the pieces
When all these pieces work together, they provide rock-solid guarantees for data integrity and speed. Consider adding a new tag 'python' to `note_id=3`: when we run `INSERT INTO note_tags(note_id,tag_id) VALUES(3,4)`, SQLite performs a sequence of checks. The foreign key check asks: does note 3 exist? Yes. Does tag 4 exist? Yes. The composite primary key check asks: is the combination `(3,4)` unique in the table? Yes. Only then does the insert succeed. Conversely, if we issue a command to `DELETE` user alice, the `CASCADE` constraint automatically deletes all of alice's notes, which in turn cascades to delete all `note_tags` entries associated with those notes. Referential integrity is strictly maintained through every layer of the system.
