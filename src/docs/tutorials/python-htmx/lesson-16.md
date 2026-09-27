# Lesson 16: Password Hashing — argon2-cffi, Why Argon2 Wins, and Upgrade Paths

**What you will build**
You will implement secure password hashing and verification using the Argon2id algorithm via the `argon2-cffi` library. This ensures that even if your database is compromised, attackers cannot easily reverse the hashes to discover user passwords. The transferable problem solved here is securely storing user credentials against offline brute-force and GPU-accelerated attacks.

**What you need to know first**
- This lesson follows Module 3: Cryptography and Secrets. 
- You need a basic understanding of Python dictionaries and SQLite database operations.

**Terms used in this lesson**
- **Argon2 / Argon2id** — The winner of the 2015 Password Hashing Competition. It is a memory-hard key derivation function designed to resist GPU and ASIC cracking by requiring significant RAM per attempt.
- **Memory-hardness** — A property of a hashing algorithm where computation is bound by memory access speed and volume rather than just CPU cycles. It prevents attackers from massively parallelizing hash attempts on GPUs.
- **Salt** — A random string added to a password before hashing. It ensures that two users with the same password have different hashes, preventing the use of precomputed rainbow tables.
- **Hash parameters (cost factors)** — Configuration settings (time iterations, memory size, thread count) that determine how expensive the hash is to compute. They allow the hash difficulty to scale as hardware improves.

**Objects and methods used**

- **`argon2.PasswordHasher`**
  - *What it is:* The main high-level API class for creating and verifying Argon2 hashes in Python.
  - *Implementation:* `class PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4, hash_len=32, salt_len=16, ...)`
  - *Its use:* We use it to instantiate a hasher configured with our desired security parameters before hashing or verifying passwords.
  - *Type:* Class
  - *Responsibility:* Manages Argon2 configuration and coordinates the generation of salts and execution of the underlying C implementation.
  - *Depends on:* Configuration arguments for time cost, memory cost, and parallelism.
  - *Connects to:* Called by application code during registration and login. Calls the underlying `cffi` bindings.
  - *Shape:* A service object instantiated in the application layer, interacting with native crypto libraries.

- **`PasswordHasher.hash`**
  - *What it is:* The method that computes the Argon2 hash for a given plaintext password.
  - *Implementation:* `def hash(self, password: str | bytes) -> str`
  - *Its use:* We call it when a user registers or changes their password to generate the string we store in the database.
  - *Type:* Instance method
  - *Responsibility:* Generates a random salt, derives the key using Argon2, and encodes the parameters, salt, and hash into a single standardized string format.
  - *Depends on:* The `PasswordHasher` instance configuration and the plaintext password.
  - *Connects to:* Called by registration/password-change flows. Returns a formatted string to be stored.
  - *Shape:* A pure computation boundary transforming sensitive plaintext into safe-to-store ciphertext.

- **`PasswordHasher.verify`**
  - *What it is:* The method that checks if a plaintext password matches a stored hash.
  - *Implementation:* `def verify(self, hash: str | bytes, password: str | bytes) -> bool`
  - *Its use:* We call it during login to validate the user's submitted password against the database record.
  - *Type:* Instance method
  - *Responsibility:* Parses the stored hash string to extract parameters and salt, recomputes the hash using those exact parameters, and performs a constant-time comparison to prevent timing attacks.
  - *Depends on:* The stored hash string (which contains the salt and parameters) and the plaintext password.
  - *Connects to:* Called by the login flow.
  - *Shape:* An authentication verification boundary.

- **`PasswordHasher.check_needs_rehash`**
  - *What it is:* A utility to detect if a stored hash was created with weaker parameters than currently configured.
  - *Implementation:* `def check_needs_rehash(self, hash: str | bytes) -> bool`
  - *Its use:* We call it after a successful login to silently upgrade older hashes to new security standards without prompting the user.
  - *Type:* Instance method
  - *Responsibility:* Compares the parameters embedded in a stored hash string against the `PasswordHasher` instance's current parameters.
  - *Depends on:* The stored hash string.
  - *Connects to:* Called immediately after a successful `verify`. Dictates whether a new `hash` call is needed.
  - *Shape:* A migration helper sitting in the authentication flow.

- **`argon2.exceptions.VerifyMismatchError`**
  - *What it is:* The specific exception raised when a password does not match the hash.
  - *Implementation:* `class VerifyMismatchError(VerificationError)`
  - *Its use:* We catch this exception to deny login access.
  - *Type:* Exception class
  - *Responsibility:* Signals an authentication failure securely, rather than returning a boolean that might be ignored.
  - *Depends on:* Raised by `verify`.
  - *Connects to:* Caught by our `try/except` block in the login route.
  - *Shape:* An error flow boundary dictating failure paths.

## Concept Unit: argon2-cffi basics

### The Problem
How do we convert a user's plaintext password into a secure format that is safe to store in our database, ensuring that even if the database is leaked, the original password cannot be easily recovered?

### Introduce the concept in isolation
We use the **Argon2id** algorithm via the `argon2-cffi` library to hash passwords.

```python
from argon2 import PasswordHasher
# PasswordHasher: high-level API. Handles salt, params, encoding automatically.
ph = PasswordHasher(
    time_cost=2,       # number of iterations
    memory_cost=65536, # memory in KiB (64MB)
    parallelism=2,     # threads
    hash_len=32,       # output hash length in bytes
    salt_len=16,       # salt length in bytes
)
# Hash a password:
hashed = ph.hash('my_secret_password')
print('Hashed:', hashed)
# Format: $argon2id$v=19$m=65536,t=2,p=2$<salt>$<hash>
# All parameters encoded in the hash string itself
print('Type:', hashed.split('$')[1])      # 'argon2id'
print('Version:', hashed.split('$')[2])   # 'v=19'
print('Params:', hashed.split('$')[3])    # 'm=65536,t=2,p=2'
# Salt and hash embedded: no need to store separately
print('Length of hash string:', len(hashed))
```
This proves that the single string returned by `ph.hash()` contains everything needed: the algorithm version, the cost parameters, the salt, and the actual hash.

### Discard the throwaway
This throwaway demonstration is deleted and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are introducing password hashing for the first time.
- **Files affected:** `app.py` (created/modified)
- **Change type:** add
- **Location:** At the top of the file, establishing our global hasher.
- **Dependencies:** `pip install argon2-cffi`

### The New Code
```python
from argon2 import PasswordHasher

ph = PasswordHasher(
    time_cost=2,
    memory_cost=65536,
    parallelism=2
)
```

### The Updated Project
```python
// ← new
1: from argon2 import PasswordHasher
2: 
3: ph = PasswordHasher(
4:     time_cost=2,
5:     memory_cost=65536,
6:     parallelism=2
7: )
```
This initializes the hasher with specific parameters that we will use throughout the application.

### Mechanical walkthrough
- `from argon2 import PasswordHasher` imports the main class.
- `ph = PasswordHasher(...)` creates an instance of it.
- `time_cost=2` sets the number of iterations the algorithm will perform.
- `memory_cost=65536` dictates that 64MB of RAM will be required to compute each hash.
- `parallelism=2` allows the computation to use 2 threads.

### CS lens
Argon2id is a memory-hard function. In computer science, most algorithms are optimized to use as little memory as possible. Memory-hard algorithms deliberately waste memory to create a bottleneck. By forcing the CPU to read and write large swaths of RAM unpredictably, it neutralizes the advantage of GPUs, which have thousands of arithmetic cores but relatively limited memory bandwidth and total VRAM per core.

### SE lens
Encoding the parameters and salt directly into the output string (the Modular Crypt Format / PHC string format) is a brilliant software engineering design. It means the database schema only needs one single column (`password_hash`). If the database had to store the salt, iterations, and memory cost in separate columns, every schema migration and ORM model would be significantly more complex.

### Commands needed
`pip install argon2-cffi`

### Run it
No execution needed here as we just initialized the hasher.

### One sentence connecting to previous unit
Now that we can generate hashes, we need to know how to verify them when a user logs in.

## Concept Unit: Verifying passwords

### The Problem
When a user logs in, they provide a plaintext password, but we only have a hash string. Since hashing is a one-way mathematical function, how do we prove the password is correct without being able to reverse the hash back to plaintext?

### Introduce the concept in isolation
We verify passwords using `ph.verify()`, which expects to succeed or raises an exception.

```python
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

ph = PasswordHasher()
hashed = ph.hash('correct_password')

# Verify correct password:
try:
    ph.verify(hashed, 'correct_password')
    print('Password correct!')  # verify() returns True or raises
except VerifyMismatchError:
    print('Wrong password.')

# Verify wrong password:
try:
    ph.verify(hashed, 'wrong_password')
except VerifyMismatchError:
    print('Mismatch: wrong password (expected)')  # prints this
except VerificationError as e:
    print('Verification error:', e)
except InvalidHashError:
    print('Invalid hash format')
```
This proves that verification raises `VerifyMismatchError` on failure rather than returning a boolean `False`.

### Discard the throwaway
This throwaway script is deleted and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are building the authentication logic.
- **Files affected:** `app.py`
- **Change type:** add
- **Location:** In the login handler function.
- **Dependencies:** The previously initialized `ph` object.

### The New Code
```python
from argon2.exceptions import VerifyMismatchError

def check_password(stored_hash, provided_password):
    try:
        ph.verify(stored_hash, provided_password)
        return True
    except VerifyMismatchError:
        return False
```

### The Updated Project
```python
  from argon2 import PasswordHasher
+ from argon2.exceptions import VerifyMismatchError

  ph = PasswordHasher(
      time_cost=2,
      memory_cost=65536,
      parallelism=2
  )

// ← new
+ def check_password(stored_hash, provided_password):
+     try:
+         ph.verify(stored_hash, provided_password)
+         return True
+     except VerifyMismatchError:
+         return False
```
We define a helper function to wrap the exception-based API into a boolean result for our login flow.

### Mechanical walkthrough
- `from argon2.exceptions import VerifyMismatchError` imports the specific error.
- `def check_password(stored_hash, provided_password):` defines our helper.
- `try:` begins an exception-handling block.
- `ph.verify(stored_hash, provided_password)` parses the `stored_hash`, extracts the salt and parameters, hashes `provided_password` with them, and compares the result.
- `return True` executes only if no exception was raised.
- `except VerifyMismatchError:` catches a specific failure.
- `return False` handles the failure cleanly.

### CS lens
`ph.verify` uses a constant-time comparison (e.g., `hmac.compare_digest` under the hood). If you use a normal string comparison (`==`), it compares character by character and returns `False` the moment it finds a difference. An attacker can measure exactly how many microseconds the comparison took to deduce how many characters they guessed correctly. Constant-time comparison always takes the same amount of time, regardless of where the mismatch occurs.

### SE lens
Throwing an exception on authentication failure, rather than returning a boolean, follows the "fail-secure" principle. If a developer accidentally forgets to check a return value (`ph.verify(hash, pwd)` instead of `if ph.verify(hash, pwd):`), an exception crashes the program and denies access. A boolean return would silently succeed, allowing unauthorized access.

### Commands needed
None.

### Run it
Running this defines the function but produces no output until called.

### One sentence connecting to previous unit
Verification works great, but hardware gets faster over time, meaning we will eventually need to increase our hash costs.

## Concept Unit: needs_rehash — upgrading hashes transparently

### The Problem
If we increase our `time_cost` or `memory_cost` to keep up with faster GPUs, all existing users in our database still have hashes generated with the old, weaker settings. How do we upgrade their hashes to the new settings without asking them to reset their passwords?

### Introduce the concept in isolation
We can use `check_needs_rehash` to detect weak hashes and update them during login.

```python
from argon2 import PasswordHasher

old_ph = PasswordHasher(time_cost=1, memory_cost=8192)   # old weak settings
new_ph = PasswordHasher(time_cost=3, memory_cost=65536)  # new strong settings

# Simulate: old hash in database
old_hash = old_ph.hash('user_password')
print('Old hash params:', old_hash.split('$')[3])  # m=8192,t=1,p=2

# At login time:
def login(stored_hash, submitted_password):
    from argon2.exceptions import VerifyMismatchError
    try:
        new_ph.verify(stored_hash, submitted_password)  # verify still works with old hash
    except VerifyMismatchError:
        return None, 'Wrong password'
    
    # Check if hash needs upgrading:
    if new_ph.check_needs_rehash(stored_hash):
        new_hash = new_ph.hash(submitted_password)
        print('Rehashing with new params. Store:', new_hash[:30], '...')
        return new_hash, 'OK'  # caller saves new_hash to DB
        
    return stored_hash, 'OK'

new_hash, status = login(old_hash, 'user_password')
print('Status:', status)
```
This proves that a hasher configured with strong settings can still verify a hash made with weak settings, and can inform us that an upgrade is needed.

### Discard the throwaway
This throwaway simulation is deleted and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are adding upgrade logic.
- **Files affected:** `app.py`
- **Change type:** replace
- **Location:** Inside `check_password`.
- **Dependencies:** None.

### The New Code
```python
def check_password(stored_hash, provided_password):
    try:
        ph.verify(stored_hash, provided_password)
        if ph.check_needs_rehash(stored_hash):
            return True, ph.hash(provided_password)
        return True, None
    except VerifyMismatchError:
        return False, None
```

### The Updated Project
```python
// ← new (replacing previous check_password)
1: def check_password(stored_hash, provided_password):
2:     try:
3:         ph.verify(stored_hash, provided_password)
4:         if ph.check_needs_rehash(stored_hash):
5:             return True, ph.hash(provided_password)
6:         return True, None
7:     except VerifyMismatchError:
8:         return False, None
```
Our helper now returns a tuple: `(is_correct, new_hash_if_needed)`. The calling code is now responsible for saving the new hash if one is returned.

### Mechanical walkthrough
- `ph.verify(stored_hash, provided_password)` succeeds if the password is correct.
- `if ph.check_needs_rehash(stored_hash):` compares the parameters in `stored_hash` against `ph`'s configured parameters.
- `return True, ph.hash(provided_password)` generates a brand new hash with the current strong settings using the known-correct plaintext password, and returns it.
- `return True, None` returns normally if no upgrade is needed.
- `return False, None` handles the error case.

### CS lens
This pattern is a form of opportunistic state migration. Instead of running a massive batch job to migrate data (which is impossible here anyway, since we don't know the plaintexts), we migrate the data lazily, one record at a time, triggered by the user proving their identity.

### SE lens
This transparent upgrade mechanism is a primary reason why encoding parameters directly into the hash string is so powerful. If the application didn't know what parameters were used to create the old hash, it couldn't tell if those parameters were out of date.

### Commands needed
None.

### Run it
Running this defines the updated function but produces no output until called.

### One sentence connecting to previous unit
Understanding how Argon2 works is helpful, but seeing it compared to older algorithms highlights why it is the standard.

## Concept Unit: Argon2 vs bcrypt vs PBKDF2

### The Problem
Why did we choose Argon2 over PBKDF2, which is built into Python's standard library, or bcrypt, which has been popular for decades?

### Introduce the concept in isolation
We can compare the memory usage of Argon2 against PBKDF2.

```python
import time
from argon2 import PasswordHasher
import hashlib, os

# Argon2id (recommended):
ph = PasswordHasher(time_cost=2, memory_cost=65536)
start = time.perf_counter()
argon2_hash = ph.hash('test_password')
argon2_time = time.perf_counter() - start
print(f'Argon2id:  {argon2_time*1000:.1f}ms, memory=64MB')

# PBKDF2-SHA256 (600k iter, NIST 2023 recommendation):
start = time.perf_counter()
pbkdf2_hash = hashlib.pbkdf2_hmac('sha256', b'test_password', os.urandom(32), 600_000)
pbkdf2_time = time.perf_counter() - start
print(f'PBKDF2:    {pbkdf2_time*1000:.1f}ms, memory=<1MB (GPU-friendly)')

print()
print('Argon2 advantage: memory-hard -> GPU parallelism limited by VRAM')
print('GPU 8GB VRAM + Argon2 64MB: max 128 parallel attempts')
print('GPU 8GB VRAM + PBKDF2:      max ~8000 parallel attempts')
```
This proves that while CPU time is similar for both, Argon2 fundamentally changes the economics for an attacker using a GPU.

### Discard the throwaway
This benchmark is deleted and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch conceptual addition.
- **Files affected:** None.
- **Change type:** none
- **Location:** Conceptual only.
- **Dependencies:** None.

### The New Code
No new project code is added in this unit.

### The Updated Project
No project files were modified.

### Mechanical walkthrough
- `hashlib.pbkdf2_hmac` generates a hash using the PBKDF2 algorithm.
- It is given `600_000` iterations to make it computationally expensive on a CPU.
- The output shows that PBKDF2 takes comparable time to Argon2 on a CPU but uses almost zero memory.
- The math shows that an attacker's GPU VRAM limits how many Argon2 hashes they can compute at once, but allows thousands of PBKDF2 hashes.

### CS lens
Asymmetric resource costs are a cornerstone of modern cryptography. You want the legitimate user (verifying one password) to experience a fast, cheap operation (e.g., 100ms and 64MB RAM). You want the attacker (guessing billions of passwords) to hit an unscalable wall. Argon2 achieves this by tying the operation to memory bandwidth, which does not scale as cheaply or easily as ALU operations on a GPU.

### SE lens
When selecting cryptographic libraries, standardizing on the winner of a public, peer-reviewed competition (like the Password Hashing Competition) is vastly preferable to inventing your own scheme. Argon2id is the specific variant recommended for general use because it balances resistance against both GPU attacks and side-channel attacks.

### Commands needed
None.

### Run it
No execution needed.

### One sentence connecting to previous unit
Now that we have chosen and configured Argon2, we must integrate it with a database to complete a real authentication flow.

## Concept Unit: Storing and using argon2 hashes in SQLite

### The Problem
How do we wire up our hashing logic to an actual database so that users can register and subsequently log in?

### Introduce the concept in isolation
We will use an in-memory SQLite database to demonstrate the complete lifecycle.

```python
import sqlite3
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

ph = PasswordHasher()
con = sqlite3.connect(':memory:')
con.row_factory = sqlite3.Row
con.execute('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL)')
con.commit()

def register_user(username, password):
    hashed = ph.hash(password)  # includes salt, params
    try:
        con.execute('INSERT INTO users (username, password_hash) VALUES (?,?)', (username, hashed))
        con.commit()
        return {'ok': True}
    except sqlite3.IntegrityError:
        return {'ok': False, 'error': 'Username taken'}

def login_user(username, password):
    row = con.execute('SELECT id, password_hash FROM users WHERE username=?', (username,)).fetchone()
    if not row: return {'ok': False, 'error': 'User not found'}  # timing: same as wrong password ideally
    
    try:
        ph.verify(row['password_hash'], password)
        if ph.check_needs_rehash(row['password_hash']):
            new_hash = ph.hash(password)
            con.execute('UPDATE users SET password_hash=? WHERE id=?', (new_hash, row['id']))
            con.commit()
        return {'ok': True, 'user_id': row['id']}
    except VerifyMismatchError:
        return {'ok': False, 'error': 'Wrong password'}

print(register_user('alice', 'my_password'))   # {'ok': True}
print(login_user('alice', 'my_password'))      # {'ok': True, 'user_id': 1}
print(login_user('alice', 'wrong'))            # {'ok': False, 'error': 'Wrong password'}
print(login_user('nobody', 'any'))             # {'ok': False, 'error': 'User not found'}
```
This proves that storing the hash string is enough to support registration, login, and rehashing in a real relational database.

### Discard the throwaway
This throwaway demonstration is deleted and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are wiring our app to a database.
- **Files affected:** `app.py`
- **Change type:** add
- **Location:** Appending to the bottom of the file.
- **Dependencies:** SQLite3 module.

### The New Code
```python
import sqlite3

con = sqlite3.connect('app.db')
con.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT)')

def register(username, password):
    hashed = ph.hash(password)
    try:
        con.execute('INSERT INTO users (username, password_hash) VALUES (?,?)', (username, hashed))
        con.commit()
    except sqlite3.IntegrityError:
        pass # Handle duplicate user
```

### The Updated Project
```python
  from argon2 import PasswordHasher
  from argon2.exceptions import VerifyMismatchError

  ph = PasswordHasher(
      time_cost=2,
      memory_cost=65536,
      parallelism=2
  )

  def check_password(stored_hash, provided_password):
      try:
          ph.verify(stored_hash, provided_password)
          if ph.check_needs_rehash(stored_hash):
              return True, ph.hash(provided_password)
          return True, None
      except VerifyMismatchError:
          return False, None

// ← new
+ import sqlite3
+ 
+ con = sqlite3.connect('app.db')
+ con.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT)')
+ 
+ def register(username, password):
+     hashed = ph.hash(password)
+     try:
+         con.execute('INSERT INTO users (username, password_hash) VALUES (?,?)', (username, hashed))
+         con.commit()
+     except sqlite3.IntegrityError:
+         pass # Handle duplicate user
```
This finalizes our setup by creating a real database file and a function to insert new users using the hasher.

### Mechanical walkthrough
- `import sqlite3` loads the database module.
- `con = sqlite3.connect('app.db')` opens a connection to a local file.
- `con.execute('CREATE TABLE ...')` ensures the users table exists. Notice that there is no `salt` column, only `password_hash`.
- `hashed = ph.hash(password)` generates the Argon2id string.
- `con.execute('INSERT ...', (username, hashed))` stores the username and the hashed password securely.
- `except sqlite3.IntegrityError:` catches attempts to register a username that is already taken due to the `UNIQUE` constraint.

### CS lens
Relational databases enforce constraints like `UNIQUE` efficiently using indexes. By letting the database catch duplicates via `IntegrityError`, we avoid a "check-then-act" race condition (where we check if a user exists, but another thread inserts the user before we can).

### SE lens
Storing the hash directly in a single column greatly simplifies the data model. If we ever switch from Argon2 to a hypothetical Argon3 in the future, the new hashes will simply be written to the exact same column, and the application code will detect the format automatically.

### Commands needed
`python app.py`

### Run it
No execution needed here, but running the file would create the `app.db` file.

### One sentence connecting to previous unit
With registration and login wired up, our users can now authenticate securely.

## Closing
### Connect the pieces
Let's trace a new user registration: a user submits `'s3cret'`. We call `ph.hash('s3cret')`, which generates a 97-character Argon2id string containing an embedded salt and configuration parameters. This string is stored directly in the `users.password_hash` column. Later, during login, we fetch that string and call `ph.verify(stored, 's3cret')`. It returns `True`. We then call `check_needs_rehash(stored)`, which returns `False` because the hash is up to date, and a secure session is successfully created.
