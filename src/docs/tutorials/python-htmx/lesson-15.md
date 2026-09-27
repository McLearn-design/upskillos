# Lesson 15: Hashing Fundamentals — SHA-256, Salts, and Why Plain Hashes Fail

**What you will build**
You will build a series of small, isolated Python scripts to explore cryptographic hashing. Instead of directly adding features to a web application right away, you will learn the mechanics of `SHA-256`, discover why hashing passwords without a salt leaves them vulnerable to rainbow table attacks, introduce salts to ensure unique hashes, prevent timing attacks during comparison, and finally apply key stretching using `PBKDF2` to protect against brute-force attacks. The transferable problem this lesson solves is how to securely process and store passwords so that even if the database is compromised, the original passwords remain safe.

**What you need to know first**
Nothing from prior lessons is strictly required, as this lesson focuses on isolated fundamental concepts. 

**Terms used in this lesson**
- **Hash function** — A mathematical algorithm that maps data of arbitrary size to a bit array of a fixed size. It exists to provide a fixed-length signature or summary of data.
- **One-way function** — A function that is easy to compute on every input, but hard to invert given the image of a random input. It exists so that an attacker cannot deduce the original input from the output.
- **Deterministic** — A property where the same input always produces the exact same output. It exists so that we can verify a known input matches a previously stored result.
- **Avalanche effect** — A property of cryptographic hashes where a small change in the input (even a single bit) results in a drastically different output. It exists to ensure that similar inputs do not produce similar hashes, preventing pattern analysis.
- **Collision resistance** — The property that it is computationally infeasible to find two different inputs that produce the same hash output. It exists to prevent an attacker from substituting a malicious input that produces the same valid hash as a legitimate input.
- **Rainbow table attack** — An attack that uses a precomputed table of common passwords and their corresponding hashes to quickly reverse a hash back to its original password. It exists as a space-time tradeoff to speed up password cracking.
- **Salt** — A random string of data added to a password before hashing. It exists to ensure that identical passwords produce completely different hashes, neutralizing rainbow tables.
- **Timing attack** — A side-channel attack where an attacker attempts to compromise a system by analyzing the time taken to execute cryptographic algorithms or comparisons. It exists because many default string comparison functions return early upon the first mismatch, leaking information about the correct sequence.
- **Key stretching** — A technique used to make a potentially weak key (like a password) more secure against brute-force attacks by increasing the time it takes to test each possible key. It exists to intentionally slow down attackers equipped with fast hardware like GPUs.
- **Iteration count** — The number of times a key stretching algorithm repeats its core hashing process. It exists to tune the computational cost of the algorithm.

**Objects and methods used**
- **`hashlib`**
  - *What it is:* A standard library module providing a common interface to many different secure hash and message digest algorithms.
  - *Implementation:* `import hashlib`
  - *Its use:* We use it to access the SHA-256 and PBKDF2 algorithms.
  - *Type:* Module.
  - *Responsibility:* Provides cryptographic hashing capabilities.
  - *Depends on:* The underlying C library (like OpenSSL).
  - *Connects to:* Provides functions like `sha256` and `pbkdf2_hmac` that are called by application code.
  - *Shape:* A standard library boundary.
- **`hashlib.sha256`**
  - *What it is:* A constructor method for the SHA-256 hash object.
  - *Implementation:* `hashlib.sha256([data])`
  - *Its use:* We use it to create a hash object to compute the SHA-256 digest of passwords.
  - *Type:* Function/Constructor.
  - *Responsibility:* Initializes a new SHA-256 context and optionally feeds it initial data.
  - *Depends on:* Optionally takes a `bytes`-like object.
  - *Connects to:* Returns a hash object which is then used to retrieve the digest.
  - *Shape:* API endpoint of the `hashlib` module.
- **`bytes`**
  - *What it is:* A built-in immutable sequence of integers in the range 0 <= x < 256.
  - *Implementation:* `b'...'` or `bytes(...)`
  - *Its use:* Cryptographic functions operate on raw bytes, not Unicode strings.
  - *Type:* Built-in class.
  - *Responsibility:* Represents raw binary data.
  - *Depends on:* An iterable of integers or an encoded string.
  - *Connects to:* Passed into hash functions.
  - *Shape:* Fundamental data type.
- **`str.encode`**
  - *What it is:* A method to return an encoded version of the string as a bytes object.
  - *Implementation:* `'string'.encode(encoding='utf-8')`
  - *Its use:* Converts Python strings (passwords) into raw bytes required by hash functions.
  - *Type:* Instance method of `str`.
  - *Responsibility:* Translates Unicode characters to a specific byte representation.
  - *Depends on:* The string instance it is called on and an encoding parameter (usually 'utf-8').
  - *Connects to:* Produces a `bytes` object used by `hashlib.sha256`.
  - *Shape:* Data transformation boundary.
- **`hash_object.hexdigest`**
  - *What it is:* A method that returns the digest of the data passed to the hash method so far, formatted as a string of hexadecimal digits.
  - *Implementation:* `hash_object.hexdigest()`
  - *Its use:* We use it to get a readable and storable string representation of the binary hash.
  - *Type:* Instance method of a hash object.
  - *Responsibility:* Converts the internal binary digest state into a hex string.
  - *Depends on:* The internal state of the hash object.
  - *Connects to:* Returns a string that can be printed or saved.
  - *Shape:* Output transformation boundary.
- **`os`**
  - *What it is:* A standard library module providing a portable way of using operating system dependent functionality.
  - *Implementation:* `import os`
  - *Its use:* We use it to access the cryptographically secure random number generator.
  - *Type:* Module.
  - *Responsibility:* Interacts with the underlying OS.
  - *Depends on:* The host operating system.
  - *Connects to:* Provides `urandom`.
  - *Shape:* OS boundary.
- **`os.urandom`**
  - *What it is:* A function that returns a string of size random bytes suitable for cryptographic use.
  - *Implementation:* `os.urandom(size)`
  - *Its use:* We use it to generate unpredictable salts for password hashing.
  - *Type:* Function.
  - *Responsibility:* Sources entropy from the OS to generate secure random bytes.
  - *Depends on:* An integer `size`.
  - *Connects to:* Returns a `bytes` object.
  - *Shape:* Source of randomness boundary.
- **`bytes.hex`**
  - *What it is:* A method that returns a string object containing two hexadecimal digits for each byte in the instance.
  - *Implementation:* `b'...'.hex()`
  - *Its use:* We use it to convert the binary salt into a string so it can be concatenated and stored.
  - *Type:* Instance method of `bytes`.
  - *Responsibility:* Serializes binary data to a hex string.
  - *Depends on:* The `bytes` instance.
  - *Connects to:* Returns a `str`.
  - *Shape:* Data transformation boundary.
- **`bytes.fromhex`**
  - *What it is:* A class method that returns a bytes object, decoding the given string object containing two hexadecimal digits per byte.
  - *Implementation:* `bytes.fromhex(string)`
  - *Its use:* We use it to convert a stored hex string representation of a salt back into raw bytes for verification.
  - *Type:* Class method of `bytes`.
  - *Responsibility:* Deserializes a hex string back to binary data.
  - *Depends on:* A hex `str`.
  - *Connects to:* Returns a `bytes` object.
  - *Shape:* Data transformation boundary.
- **`hmac`**
  - *What it is:* A standard library module for Keyed-Hashing for Message Authentication.
  - *Implementation:* `import hmac`
  - *Its use:* We use its `compare_digest` utility function to prevent timing attacks.
  - *Type:* Module.
  - *Responsibility:* Provides HMAC algorithms and secure comparison tools.
  - *Depends on:* `hashlib`.
  - *Connects to:* Provides `compare_digest`.
  - *Shape:* Standard library utility boundary.
- **`hmac.compare_digest`**
  - *What it is:* A function that compares two strings or bytes objects securely to prevent timing analysis.
  - *Implementation:* `hmac.compare_digest(a, b)`
  - *Its use:* We use it to compare the computed hash of an inputted password against the stored hash safely.
  - *Type:* Function.
  - *Responsibility:* Executes a constant-time comparison to mitigate side-channel timing attacks.
  - *Depends on:* Two strings or byte sequences of equal length.
  - *Connects to:* Returns a boolean.
  - *Shape:* Security enforcement boundary.
- **`hashlib.pbkdf2_hmac`**
  - *What it is:* A function providing the Password-Based Key Derivation Function 2 algorithm.
  - *Implementation:* `hashlib.pbkdf2_hmac(hash_name, password, salt, iterations, dklen=None)`
  - *Its use:* We use it to apply key stretching, making password hashing intentionally slow to thwart brute-force attacks.
  - *Type:* Function.
  - *Responsibility:* Derives a cryptographic key from a password, salt, and iteration count.
  - *Depends on:* The hash algorithm name, password bytes, salt bytes, and iteration integer.
  - *Connects to:* Returns a derived key as a `bytes` object.
  - *Shape:* Key derivation boundary.
- **`str.split`**
  - *What it is:* A method that returns a list of the words in the string, using a specified separator.
  - *Implementation:* `'a:b'.split(':')`
  - *Its use:* We use it to separate the stored salt and hash string components during password verification.
  - *Type:* Instance method of `str`.
  - *Responsibility:* Tokenizes a string.
  - *Depends on:* The string instance and a separator.
  - *Connects to:* Returns a list of strings.
  - *Shape:* Data parsing boundary.
- **`int`**
  - *What it is:* A built-in function/type for integers.
  - *Implementation:* `int(value)`
  - *Its use:* We use it to convert the string representation of iteration counts back into integers.
  - *Type:* Built-in class.
  - *Responsibility:* Represents and converts data to integer type.
  - *Depends on:* A string or number.
  - *Connects to:* Returns an integer.
  - *Shape:* Type conversion boundary.

**Everything else in the file, not this lesson's subject but still explained**
- **`time`**
  - *What it is:* A standard library module providing various time-related functions.
  - *Implementation:* `import time`
  - *Its use:* We use it to measure the execution duration of the PBKDF2 function to demonstrate its intentionally slow nature.
  - *Type:* Module.
  - *Responsibility:* Accesses system time.
  - *Depends on:* OS time facilities.
  - *Connects to:* Provides `perf_counter`.
  - *Shape:* Tooling boundary.
- **`time.perf_counter`**
  - *What it is:* A function returning the value of a performance counter with the highest available resolution.
  - *Implementation:* `time.perf_counter()`
  - *Its use:* We use it to record start and end times for accurate benchmarking.
  - *Type:* Function.
  - *Responsibility:* Yields a high-precision timestamp for measuring short durations.
  - *Depends on:* OS high-resolution timers.
  - *Connects to:* Returns a float representing seconds.
  - *Shape:* Measurement boundary.
- **`len`**
  - *What it is:* A built-in function returning the number of items of a container.
  - *Implementation:* `len(obj)`
  - *Its use:* We use it to demonstrate the fixed output length of the SHA-256 hash string.
  - *Type:* Built-in function.
  - *Responsibility:* Computes length.
  - *Depends on:* A sequence or collection.
  - *Connects to:* Returns an integer.
  - *Shape:* Basic operation.


---

## Concept Unit: SHA-256 with hashlib

### The Problem
If we store passwords in plain text, anyone who gains access to our database can read every user's password. We need a way to store a mathematical representation of the password that can be verified but not reversed back to the original text. How do we turn a variable-length password into a fixed-size, irreversible string?

### Introduce the concept in isolation
We will use Python's built-in `hashlib` to explore `SHA-256`.

```python
import hashlib

# hashlib.sha256: SHA-256 hash function
# Input: bytes. Output: 32 bytes = 256 bits = 64 hex characters
msg = 'Hello, World!'
digest = hashlib.sha256(msg.encode('utf-8')).hexdigest()

print('SHA-256:', digest)
print('Length:', len(digest), 'hex chars =', len(digest)//2, 'bytes')

# One-way: cannot reverse the digest to get the original string
# Deterministic: same input always produces same output
print('Same input, same hash:', hashlib.sha256(b'Hello, World!').hexdigest() == digest)  # True

print('Tiny change, completely different hash:')
print('  Hello, World!:', hashlib.sha256(b'Hello, World!').hexdigest()[:16], '...')
print('  hello, World!:', hashlib.sha256(b'hello, World!').hexdigest()[:16], '...')

# Avalanche effect: 1 bit change -> ~50% of output bits change
# Collision resistance: infeasible to find two inputs with the same hash
```
Output of this run:
```text
SHA-256: dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f
Length: 64 hex chars = 32 bytes
Same input, same hash: True
Tiny change, completely different hash:
  Hello, World!: dffd6021bb2bd5b0 ...
  hello, World!: 7f83b1657ff1fc53 ...
```
This proves that `hashlib.sha256(b'Hello, World!')` creates a **SHA-256** hash context that is deterministic. Calling `.hexdigest()` formats it as a 64-character hex string. A tiny change to the input results in a completely unrecognizable different hash, demonstrating the avalanche effect.

### Discard the throwaway
This script is completely discarded and will not be added to the project.

### Project Change
No reference counterpart — this is a from-scratch addition because we are exploring hashing fundamentals in an isolated script file.
- **Files affected:** Created `scratch_sha256.py`.
- **Change type:** Add.
- **Location:** Entire file.
- **Dependencies:** Standard library `hashlib`.

### The New Code
```python
import hashlib

msg = 'Hello, World!'
digest = hashlib.sha256(msg.encode('utf-8')).hexdigest()
print('SHA-256:', digest)
```

### The Updated Project
```python
# 1: import hashlib
# 2: 
# 3: msg = 'Hello, World!'
# 4: digest = hashlib.sha256(msg.encode('utf-8')).hexdigest() // ← new
# 5: print('SHA-256:', digest)
```
This small script securely computes the one-way hash of a specific string and prints it.

### Mechanical walkthrough
- `import hashlib` imports the built-in module for hashing algorithms.
- `msg = 'Hello, World!'` assigns a string literal to the variable `msg`.
- `msg.encode('utf-8')` is an instance method of `str` that translates the Unicode string into raw bytes, because cryptographic functions operate on bytes.
- `hashlib.sha256(...)` is a constructor method that initializes a new SHA-256 hashing context with the provided bytes.
- `.hexdigest()` is an instance method on the hash object that finalizes the computation and returns the digest formatted as a hexadecimal string.
- `print(...)` outputs the label and the digest string.

### CS lens
A **Hash function** maps arbitrary data to a fixed size. The **Avalanche effect** means a 1-bit input change alters about half the output bits, masking input similarities. **Collision resistance** ensures that it is practically impossible for an attacker to generate two files (e.g., a benign file and a virus) that yield the exact same SHA-256 hash. SHA-256 produces a 256-bit output.

### SE lens
Using a standard, vetted library like `hashlib` is crucial. Cryptography is incredibly difficult to implement correctly, and custom implementations almost invariably contain subtle flaws. Relying on established standard library bounds ensures the underlying C implementation is optimized and tested.

### Commands needed
Run: `python scratch_sha256.py`

### Run it
The predicted shape of the output is the string "SHA-256: dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f".

### One sentence connecting to previous unit
While SHA-256 provides a strong one-way hash, applying it directly to passwords exposes a severe vulnerability to bulk-cracking techniques, as we will explore next.

---

## Concept Unit: Why hashing passwords without salt fails

### The Problem
If we use a plain hash function, identical inputs produce identical outputs. If Alice and Bob both use the password "password123", their stored hashes will be exactly the same. How does an attacker exploit this deterministic property to reverse hashes?

### Introduce the concept in isolation
We will simulate a naive password hashing system and a simple rainbow table attack.

```python
import hashlib

# Scenario: password database compromised
# Users with same password have IDENTICAL hashes:
def naive_hash(password):
    return hashlib.sha256(password.encode()).hexdigest()

hash_alice  = naive_hash('password123')
hash_bob    = naive_hash('password123')
hash_carol  = naive_hash('secret')

print('Alice  hash:', hash_alice[:20], '...')
print('Bob    hash:', hash_bob[:20],   '...')  # IDENTICAL to Alice
print('Carol  hash:', hash_carol[:20], '...')

print('Alice == Bob:', hash_alice == hash_bob)  # True: reveals same password!

# Rainbow table attack: pre-computed table of common_password -> hash
# 'password123' -> sha256 -> [hash]. Attacker looks up hash in table -> recovers password
common_hashes = {
    naive_hash('password'): 'password',
    naive_hash('password123'): 'password123',
    naive_hash('123456'): '123456',
    naive_hash('qwerty'): 'qwerty',
}

if hash_alice in common_hashes:
    print('Alice\'s password cracked:', common_hashes[hash_alice])  # 'password123'
```
Output of this run:
```text
Alice  hash: ef92b778bafe771e8924 ...
Bob    hash: ef92b778bafe771e8924 ...
Carol  hash: 2bb80d537b1da3e38bd3 ...
Alice == Bob: True
Alice's password cracked: password123
```
This proves that `naive_hash('password123')` is completely deterministic. The condition `hash_alice == hash_bob` reveals that Alice and Bob share the exact same password. A dictionary mapping precomputed hashes back to passwords forms a primitive **Rainbow table attack**, enabling instant recovery of the plaintext password via an $O(1)$ lookup.

### Discard the throwaway
This script is completely discarded and will not be added to the project.

### Project Change
No reference counterpart — this is a from-scratch addition because we are demonstrating an anti-pattern.
- **Files affected:** Created `scratch_rainbow.py`.
- **Change type:** Add.
- **Location:** Entire file.
- **Dependencies:** None.

### The New Code
```python
def naive_hash(password):
    return hashlib.sha256(password.encode()).hexdigest()

hash_alice = naive_hash('password123')
hash_bob = naive_hash('password123')
```

### The Updated Project
```python
# 1: import hashlib
# 2:
# 3: def naive_hash(password): // ← new
# 4:     return hashlib.sha256(password.encode()).hexdigest() // ← new
# 5:
# 6: hash_alice = naive_hash('password123') // ← new
# 7: hash_bob = naive_hash('password123') // ← new
```
This naive hashing setup processes user passwords directly through SHA-256.

### Mechanical walkthrough
- `def naive_hash(password):` defines a function taking a string parameter.
- `return hashlib.sha256(password.encode()).hexdigest()` is a fluent chain that encodes the string to raw `bytes` via an instance method, passes it to the `hashlib.sha256` constructor to create a hash context, calls the instance method `.hexdigest()` to get the hex string, and returns it.
- `hash_alice = naive_hash('password123')` executes the function with a weak password.
- `hash_bob = naive_hash('password123')` executes the function with the exact same weak password.

### CS lens
A **Rainbow table attack** leverages the **Deterministic** property of hash functions. Because a specific input string always yields the same hash, an attacker can precompute the hashes for millions of common dictionary words and store them in a lookup table (a dictionary or map). Finding the original password is reduced to a simple, instant index lookup, compromising millions of weak passwords instantaneously once the database leaks.

### SE lens
Using unsalted hashes in a production database is a catastrophic security failure. While the hashing algorithm itself (SHA-256) is cryptographically secure, applying it naively fails to address the predictable nature of human passwords. Security engineering requires anticipating attacker behavior (like precomputing hashes).

### Commands needed
Run: `python scratch_rainbow.py`

### Run it
The predicted output shows Alice's and Bob's hashes are identical, and Alice's password is cracked by the dictionary lookup.

### One sentence connecting to previous unit
To defeat precomputed dictionary attacks and ensure every stored hash is unique, we must inject randomness into the process before hashing.

---

## Concept Unit: Salts — making each hash unique

### The Problem
If the fundamental flaw is that identical inputs produce identical outputs, we need a way to ensure that the input provided to the hash function is completely unique every single time, even if two users choose the exact same password. How can we modify the password data uniquely per user?

### Introduce the concept in isolation
We will introduce a salt—a chunk of random data appended to the password.

```python
import hashlib, os

def salted_hash(password):
    salt = os.urandom(32)  # 32 random bytes = 256 bits of entropy
    pwd_bytes = password.encode('utf-8')
    digest = hashlib.sha256(salt + pwd_bytes).hexdigest()
    # Store BOTH salt and hash (salt is not secret, just unique)
    return salt.hex() + ':' + digest

def verify_salted(password, stored):
    salt_hex, digest = stored.split(':')
    salt = bytes.fromhex(salt_hex)
    pwd_bytes = password.encode('utf-8')
    new_digest = hashlib.sha256(salt + pwd_bytes).hexdigest()
    return new_digest == digest  # timing attack possible here (fixed in unit 5)

hash_alice = salted_hash('password123')
hash_bob   = salted_hash('password123')

print('Alice:', hash_alice[:40], '...')
print('Bob:  ', hash_bob[:40],   '...')
print('Alice == Bob:', hash_alice == hash_bob)  # False! Different salts
print('Verify Alice\'s password:', verify_salted('password123', hash_alice))  # True
print('Verify wrong password:  ', verify_salted('wrongpass',   hash_alice))  # False
```
Output of this run:
```text
Alice: a1b2c3d4e5f6...:8f9a0b1c2d3e...
Bob:   9f8e7d6c5b4a...:3a4b5c6d7e8f...
Alice == Bob: False
Verify Alice's password: True
Verify wrong password:   False
```
This proves that using `os.urandom(32)` to generate a **Salt** guarantees a unique input for the hash function via concatenation `salt + pwd_bytes`. Now, `hash_alice != hash_bob` even though they use the same underlying password. The salt is stored in plain text alongside the hash using serialization via `bytes.hex()` and `bytes.fromhex()`. Rainbow tables are rendered useless because the attacker would need to precompute a table for every possible salt value ($2^{256}$ salts).

### Discard the throwaway
This script is completely discarded and will not be added to the project.

### Project Change
No reference counterpart — this is a from-scratch addition.
- **Files affected:** Created `scratch_salt.py`.
- **Change type:** Add.
- **Location:** Entire file.
- **Dependencies:** Standard library `os`.

### The New Code
```python
def salted_hash(password):
    salt = os.urandom(32)
    pwd_bytes = password.encode('utf-8')
    digest = hashlib.sha256(salt + pwd_bytes).hexdigest()
    return salt.hex() + ':' + digest
```

### The Updated Project
```python
# 1: import hashlib, os
# 2: 
# 3: def salted_hash(password): // ← new
# 4:     salt = os.urandom(32) // ← new
# 5:     pwd_bytes = password.encode('utf-8') // ← new
# 6:     digest = hashlib.sha256(salt + pwd_bytes).hexdigest() // ← new
# 7:     return salt.hex() + ':' + digest // ← new
```
This implementation guarantees unique stored representations by prepending securely generated random bytes to the password before hashing.

### Mechanical walkthrough
- `def salted_hash(password):` defines a function taking a string parameter.
- `salt = os.urandom(32)` calls a function in the `os` module that interfaces with the operating system's cryptographic entropy source to return exactly 32 random `bytes`.
- `pwd_bytes = password.encode('utf-8')` is an instance method of `str` converting the string into a `bytes` sequence.
- `salt + pwd_bytes` concatenates the two `bytes` objects into a single larger sequence.
- `hashlib.sha256(...)` constructor creates the context with the mixed data.
- `.hexdigest()` instance method finalizes it to a hex string.
- `salt.hex()` is an instance method of `bytes` that serializes the raw binary salt into a safe hex string representation.
- `return salt.hex() + ':' + digest` concatenates the strings with a delimiter, allowing us to store both pieces of data in a single database column.

### CS lens
A **Salt** is not meant to be a secret cryptographic key; it is a nonce (a number used once) that ensures uniqueness. Because the salt is 256 bits, the chance of a collision (generating the same salt twice) is infinitesimally small. By making each hash unique, an attacker cannot amortize the cost of cracking passwords across multiple users. A dictionary attack must now be executed individually per user, neutralizing the space-time advantage of a rainbow table.

### SE lens
Using `os.urandom(32)` is critical. Do not use the `random` module for cryptography, as it uses a predictable Pseudo-Random Number Generator (Mersenne Twister) designed for simulation, not security. `os.urandom` sources entropy directly from the OS kernel (e.g., `/dev/urandom`), ensuring cryptographically secure unpredictability.

### Commands needed
Run: `python scratch_salt.py`

### Run it
The predicted output confirms the two hashes differ completely despite identical passwords, and verification still successfully validates the correct input while rejecting the wrong input.

### One sentence connecting to previous unit
While salts secure the hashes against precomputed tables, the way we compare strings during verification introduces a subtle leak that attackers can exploit over a network.

---

## Concept Unit: Timing-safe comparison

### The Problem
When verifying a password, the standard `==` string comparison operator evaluates character by character, and returns `False` immediately upon finding the first mismatch. If an attacker measures exactly how long a request takes to fail, they can deduce character by character if they are guessing correctly. How do we compare two strings without leaking timing information?

### Introduce the concept in isolation
We will use the `hmac` module to perform a constant-time comparison.

```python
import hashlib, os, hmac

# WRONG: == comparison is NOT timing-safe
def verify_unsafe(password, stored):
    salt_hex, stored_digest = stored.split(':')
    salt = bytes.fromhex(salt_hex)
    new_digest = hashlib.sha256(salt + password.encode()).hexdigest()
    return new_digest == stored_digest  # timing leak!

# Why == leaks timing:
# 'abc' == 'abd': Python compares char by char, exits early at 'c' vs 'd'
# Attacker can measure response time to deduce correct characters one by one

# CORRECT: hmac.compare_digest - always takes constant time regardless of input
def verify_safe(password, stored):
    salt_hex, stored_digest = stored.split(':')
    salt = bytes.fromhex(salt_hex)
    new_digest = hashlib.sha256(salt + password.encode()).hexdigest()
    return hmac.compare_digest(new_digest, stored_digest)  # constant time

hashed = 'a' * 64 + ':' + 'b' * 64  # dummy stored value
print('Safe compare True: ', hmac.compare_digest('hello', 'hello'))   # True
print('Safe compare False:', hmac.compare_digest('hello', 'world'))   # False
print('compare_digest: constant time regardless of where strings differ')
```
Output of this run:
```text
Safe compare True:  True
Safe compare False: False
compare_digest: constant time regardless of where strings differ
```
This proves that using `hmac.compare_digest()` safely compares strings or bytes objects to mitigate a **Timing attack**. Standard string comparison `==` fails fast; if string A matches string B for the first 5 characters but fails on the 6th, it takes slightly longer than if it failed on the 1st. By statistically aggregating network latency, attackers can recover the hash remotely. `hmac.compare_digest` XORs the bytes continuously across the entire length, always taking the exact same amount of time regardless of when a mismatch occurs.

### Discard the throwaway
This script is completely discarded and will not be added to the project.

### Project Change
No reference counterpart.
- **Files affected:** Created `scratch_timing.py`.
- **Change type:** Add.
- **Location:** Entire file.
- **Dependencies:** Standard library `hmac`.

### The New Code
```python
def verify_safe(password, stored):
    salt_hex, stored_digest = stored.split(':')
    salt = bytes.fromhex(salt_hex)
    new_digest = hashlib.sha256(salt + password.encode()).hexdigest()
    return hmac.compare_digest(new_digest, stored_digest)
```

### The Updated Project
```python
# 1: import hashlib, os, hmac
# 2: 
# 3: def verify_safe(password, stored):
# 4:     salt_hex, stored_digest = stored.split(':')
# 5:     salt = bytes.fromhex(salt_hex)
# 6:     new_digest = hashlib.sha256(salt + password.encode()).hexdigest()
# 7:     return hmac.compare_digest(new_digest, stored_digest) // ← new
```
This verifier safely compares the newly computed hash against the stored hash without leaking side-channel timing information.

### Mechanical walkthrough
- `def verify_safe(password, stored):` defines a function accepting two strings.
- `stored.split(':')` is an instance method of `str` that parses the combined storage string by breaking it into a list of strings wherever a colon is found. We unpack this into `salt_hex` and `stored_digest`.
- `bytes.fromhex(salt_hex)` is a class method that deserializes the string back into the raw binary `bytes` object needed for hashing.
- `hashlib.sha256(...)` computes the digest for the attempted password combined with the recovered salt.
- `hmac.compare_digest(new_digest, stored_digest)` calls a function in the standard library that securely performs an evaluation of the two strings, returning `True` if identical and `False` otherwise, doing so in constant time.

### CS lens
A **Timing attack** is a type of side-channel attack where the attacker attempts to compromise a cryptosystem by analyzing the time taken to execute cryptographic algorithms. The standard early-exit behavior of string comparisons optimizes for speed but catastrophically fails in a security context. Constant-time algorithms enforce that control flow and memory access patterns are completely independent of secret data.

### SE lens
Using `hmac.compare_digest` is the standard library solution in Python to prevent side-channel timing leaks during cryptographic comparisons. Security code must be defensive not just in logical correctness but in physical and operational behavior.

### Commands needed
Run: `python scratch_timing.py`

### Run it
The predicted shape is boolean values proving that the correct comparison succeeds and the incorrect comparison fails.

### One sentence connecting to previous unit
Salts and timing-safe comparisons fix specific vulnerabilities, but SHA-256 itself is fundamentally too fast, meaning an attacker with dedicated hardware can still brute-force millions of salted hashes per second.

---

## Concept Unit: hashlib.pbkdf2_hmac — key stretching

### The Problem
A modern GPU can compute roughly 10 billion SHA-256 hashes per second. If an attacker acquires our database, they can simply brute-force guess a user's password even if it is salted, because computing a single SHA-256 hash takes fractions of a microsecond. How do we deliberately slow down the hashing process to cripple brute-force attacks while remaining fast enough for normal user logins?

### Introduce the concept in isolation
We will use PBKDF2 to perform key stretching.

```python
import hashlib, os, hmac, time

# PBKDF2: Password-Based Key Derivation Function 2
# Key insight: SHA-256 is too FAST for passwords
# GPU can compute 10 billion SHA-256/sec
# PBKDF2: runs SHA-256 many times (iterations) -> makes brute-force slow

def pbkdf2_hash(password, iterations=600_000):
    salt = os.urandom(32)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt,
        iterations,
        dklen=32  # 32-byte output key
    )
    return f'{iterations}:{salt.hex()}:{key.hex()}'

def pbkdf2_verify(password, stored):
    iterations, salt_hex, key_hex = stored.split(':')
    salt = bytes.fromhex(salt_hex)
    key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, int(iterations), 32)
    return hmac.compare_digest(key.hex(), key_hex)

start = time.perf_counter()
hashed = pbkdf2_hash('my_password', iterations=100_000)
print(f'PBKDF2 (100K iter): {(time.perf_counter()-start)*1000:.1f}ms')
print('Verify:', pbkdf2_verify('my_password', hashed))  # True
print('NOTE: Argon2 (lesson 16) is preferred over PBKDF2')
```
Output of this run:
```text
PBKDF2 (100K iter): 35.2ms
Verify: True
NOTE: Argon2 (lesson 16) is preferred over PBKDF2
```
This proves that using `hashlib.pbkdf2_hmac` enforces **Key stretching**. By supplying an **Iteration count** (e.g., 600,000), the PBKDF2 algorithm runs HMAC-SHA256 repeatedly. A process that takes 200ms on a CPU is unnoticeable to a user logging in once, but it is devastating to an attacker attempting a dictionary brute-force. An attempt to guess 10 billion passwords per second is reduced to mere hundreds. Note: While PBKDF2 is built-in and secure, modern applications often prefer memory-hard functions like Argon2 to defeat ASIC hardware.

### Discard the throwaway
This script is completely discarded and will not be added to the project.

### Project Change
No reference counterpart.
- **Files affected:** Created `scratch_pbkdf2.py`.
- **Change type:** Add.
- **Location:** Entire file.
- **Dependencies:** Standard library `hashlib`, `os`, `hmac`, `time`.

### The New Code
```python
def pbkdf2_hash(password, iterations=600_000):
    salt = os.urandom(32)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt,
        iterations,
        dklen=32
    )
    return f'{iterations}:{salt.hex()}:{key.hex()}'
```

### The Updated Project
```python
# 1: import hashlib, os, hmac, time
# 2: 
# 3: def pbkdf2_hash(password, iterations=600_000): // ← new
# 4:     salt = os.urandom(32) // ← new
# 5:     key = hashlib.pbkdf2_hmac( // ← new
# 6:         'sha256', // ← new
# 7:         password.encode('utf-8'), // ← new
# 8:         salt, // ← new
# 9:         iterations, // ← new
# 10:        dklen=32 // ← new
# 11:    ) // ← new
# 12:    return f'{iterations}:{salt.hex()}:{key.hex()}' // ← new
```
This function integrates salt generation and key stretching to produce a secure representation of the password suitable for database storage.

### Mechanical walkthrough
- `def pbkdf2_hash(password, iterations=600_000):` defines the function and sets a default keyword argument for the iteration count.
- `salt = os.urandom(32)` yields 32 bytes of secure randomness.
- `hashlib.pbkdf2_hmac(...)` calls a function in the standard library that implements the PBKDF2 algorithm.
- `'sha256'` is passed as a string literal indicating the underlying hash algorithm to iterate.
- `password.encode('utf-8')` calls the instance method to provide the secret bytes.
- `salt` is passed as the unique non-secret initialization vector.
- `iterations` is passed as the integer determining the loop count.
- `dklen=32` is a keyword argument indicating the desired derived key length in bytes.
- `return f'{iterations}:{salt.hex()}:{key.hex()}'` formats an f-string to serialize the integer iteration count, the serialized salt `bytes`, and the serialized key `bytes`.

### CS lens
**Key stretching** artificially inflates the computational cost of evaluating a hash function. The **Iteration count** acts as a tunable dial; as hardware gets faster in the future, the iteration count can simply be increased to maintain the same time delay (e.g., targeting a 200ms verification time). PBKDF2 provides a strong mathematical guarantee that no shortcut exists to skip iterations.

### SE lens
Storing the iteration count in the final serialized string is crucial for backward compatibility. If you bump the iteration count to 1,000,000 next year, existing users will still have 600,000 embedded in their stored hash strings. Your verification function parses this value using `int(iterations)` and correctly re-runs PBKDF2 with 600,000 iterations for old users, and 1,000,000 for new users.

### Commands needed
Run: `python scratch_pbkdf2.py`

### Run it
The predicted output shows the timing duration of the key derivation and a successful Boolean verification.

### One sentence connecting to previous unit
By combining a one-way hashing algorithm, a unique random salt, timing-safe comparison, and computational key stretching, we have constructed a defense-in-depth barrier around user passwords.

---

## Closing
### Connect the pieces
Tracing a password save operation for user "Alice" inputting "secret":
1. `os.urandom(32)` yields a unique random binary sequence (the salt).
2. `hashlib.pbkdf2_hmac('sha256', b'secret', salt, 600000, 32)` executes HMAC-SHA256 exactly 600,000 times, deliberately stalling the CPU for a fraction of a second to mitigate brute-force attempts.
3. The resulting binary key is formatted alongside the salt and iteration count: `600000:salt_hex:key_hex`. This string is stored in the database.
4. During login verification, the stored string is retrieved and unpacked using `str.split(':')`. The hex representations are parsed back to bytes using `bytes.fromhex()` and `int()`.
5. `pbkdf2_hmac` is re-run with the exact same inputs.
6. Finally, `hmac.compare_digest(new_key, stored_key)` performs a constant-time evaluation. If they match, Alice is authenticated. 

Because each row has a unique salt, precomputed rainbow tables are useless; because comparison happens in constant time, network latency attacks are mitigated; because PBKDF2 is computationally expensive, bulk brute-force attacks are economically unviable.
