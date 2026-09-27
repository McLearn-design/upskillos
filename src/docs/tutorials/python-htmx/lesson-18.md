# Lesson 18: Symmetric Encryption — Fernet, Key Management, and When to Encrypt vs Hash

**What you will build**
We will implement secure storage of sensitive data that must be recovered later, such as API keys and email addresses for GDPR compliance, while learning to differentiate between scenarios requiring reversible encryption versus irreversible hashing. 

**What you need to know first**
- Lesson 17

**Terms used in this lesson**
- **Symmetric encryption** — A cryptographic algorithm that uses the same cryptographic key for both encryption of plaintext and decryption of ciphertext. It solves the problem of needing to recover the original data later while keeping it secure at rest.
- **Hashing** — A cryptographic process that maps data of arbitrary size to fixed-size values. It is irreversible. It solves the problem of verifying data (like a password) without ever needing or storing the original value.
- **Ciphertext** — The encrypted, unreadable result of an encryption algorithm. It solves the problem of safely transmitting or storing sensitive data.
- **Plaintext** — The original, unencrypted, readable data.
- **Key rotation** — The practice of periodically changing cryptographic keys to limit the amount of data compromised if a single key is exposed.

**Objects and methods used**

**`Fernet`**
- *What it is:* A symmetric authenticated cryptography recipe provided by the Python `cryptography` library.
- *Implementation:* `class cryptography.fernet.Fernet(key: bytes | str)`
- *Its use:* To safely encrypt and decrypt data where the original value needs to be retrieved, using AES-128-CBC and HMAC-SHA256.
- *Type:* Class
- *Responsibility:* Encrypts and decrypts data securely, ensuring both confidentiality (via AES) and authenticity (via HMAC).
- *Depends on:* A 32-byte URL-safe base64-encoded key.
- *Connects to:* Calls underlying OpenSSL cryptographic primitives.
- *Shape:* A security boundary protecting sensitive application data before it hits the database.

**`Fernet.generate_key()`**
- *What it is:* A static method that generates a fresh fernet key.
- *Implementation:* `@classmethod def generate_key() -> bytes`
- *Its use:* Used to create secure, cryptographically random keys for initializing `Fernet` instances.
- *Type:* Class method
- *Responsibility:* Generates a 32-byte cryptographically secure random value and encodes it as base64url.
- *Depends on:* `os.urandom(32)`.
- *Connects to:* Returns a key to the application for storage or direct injection into `Fernet()`.
- *Shape:* Initialization step of the encryption pipeline.

**`Fernet.encrypt()`**
- *What it is:* The method that turns plaintext into ciphertext.
- *Implementation:* `def encrypt(data: bytes) -> bytes`
- *Its use:* To encrypt sensitive data before storing or sending it.
- *Type:* Instance method
- *Responsibility:* Generates a random 16-byte IV, encrypts the data using AES-128-CBC, appends the timestamp, and signs the entire token with HMAC-SHA256.
- *Depends on:* The plain `data` as `bytes`, and the key given during initialization.
- *Connects to:* Returns a URL-safe base64-encoded Fernet token.
- *Shape:* The entry point for data protection.

**`Fernet.decrypt()`**
- *What it is:* The method that recovers plaintext from ciphertext.
- *Implementation:* `def decrypt(token: bytes | str, ttl: int | None = None) -> bytes`
- *Its use:* To retrieve the original data.
- *Type:* Instance method
- *Responsibility:* Verifies the HMAC signature, checks the timestamp (if `ttl` is provided), and decrypts the AES payload to recover original bytes.
- *Depends on:* A valid Fernet token and the correct key.
- *Connects to:* Returns the original `bytes` to the caller.
- *Shape:* The exit point of the data protection boundary.

**`MultiFernet`**
- *What it is:* A wrapper class for managing multiple Fernet keys to enable key rotation.
- *Implementation:* `class cryptography.fernet.MultiFernet(fernets: list[Fernet])`
- *Its use:* Allows seamless decryption of old data while encrypting new data with a new key.
- *Type:* Class
- *Responsibility:* Tries keys in order to decrypt data and uses the first key in the list to encrypt new data.
- *Depends on:* An ordered list of `Fernet` instances.
- *Connects to:* Delegates encryption/decryption calls to the individual `Fernet` objects.
- *Shape:* A transparent key-rotation layer sitting in front of standard encryption logic.

## Concept Unit: Fernet basics — encrypt and decrypt

### The Problem
How do we store an API key or an email address in a database so that it cannot be read if the database is stolen, but we can still read it to make API calls or send emails?

### Introduce the concept in isolation
```python
from cryptography.fernet import Fernet
# Fernet: symmetric encryption. Same key encrypts and decrypts.
# AES-128-CBC + HMAC-SHA256 internally. Authenticated encryption.

# Generate a key:
key = Fernet.generate_key()  # 32 random bytes, base64url-encoded
print('Key:', key[:20], '...')
print('Key type:', type(key))  # bytes

f = Fernet(key)

# Encrypt:
plaintext = b'alice@example.com'  # must be bytes
ciphertext = f.encrypt(plaintext)
print('Ciphertext:', ciphertext[:30], '...')
print('Ciphertext type:', type(ciphertext))  # bytes

# Decrypt:
decrypted = f.decrypt(ciphertext)
print('Decrypted:', decrypted)  # b'alice@example.com'
print('Match:', decrypted == plaintext)  # True

# Different call -> different ciphertext (random IV each time):
ct2 = f.encrypt(plaintext)
print('Same plaintext, different ciphertext:', ciphertext != ct2)  # True
```
This is called **symmetric encryption**. The output proves that the exact same original `bytes` are recovered, and that encrypting the same text twice yields different ciphertexts due to a random Initialization Vector (IV).

### Discard the throwaway
This throwaway code is discarded and will not be used in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are introducing encryption utilities.
- **Files affected:** `app.py` (created/modified)
- **Change type:** add
- **Location:** At the top of `app.py`.
- **Dependencies:** `cryptography` library.

### The New Code
```python
from cryptography.fernet import Fernet

def setup_encryption():
    key = Fernet.generate_key()
    return Fernet(key)

fernet_client = setup_encryption()
```

### The Updated Project
```python
1: from cryptography.fernet import Fernet
2: 
3: def setup_encryption():
4:     key = Fernet.generate_key()
5:     return Fernet(key)
6: 
7: fernet_client = setup_encryption() # ← new
```
This setup function initializes our global Fernet client that will be used for encryption across the app.

### Mechanical walkthrough
1. `from cryptography.fernet import Fernet` imports the class.
2. `def setup_encryption():` starts the function.
3. `Fernet.generate_key()` calls the static method to generate a 32-byte key.
4. `Fernet(key)` initializes the cipher with that key.
5. `fernet_client = setup_encryption()` creates a ready-to-use instance.

### CS lens
Symmetric encryption uses a single shared secret (the key). Fernet guarantees both Confidentiality (via AES-128 in CBC mode) and Authenticity/Integrity (via an HMAC-SHA256 signature). The HMAC ensures that if an attacker alters even a single bit of the ciphertext, decryption fails rather than returning garbage data (preventing padding oracle attacks).

### SE lens
Using an opinionated recipe like Fernet prevents developers from making poor cryptographic choices (like using ECB mode or forgetting an HMAC).

### Commands needed
`pip install cryptography`

### Run it
`python app.py`

### One sentence connecting to previous unit
Now that we can encrypt and decrypt data, we must decide when to use this versus when to use irreversible hashing.

## Concept Unit: Encrypt vs hash — choosing correctly

### The Problem
If we encrypt a user's password, we run the risk of someone stealing the key and reading every password. How do we verify a password without storing a reversible version of it?

### Introduce the concept in isolation
```python
from cryptography.fernet import Fernet
import hashlib
import os

KEY = Fernet.generate_key()
f = Fernet(KEY)

# Use ENCRYPTION when you need the original value back:
api_key = 'sk-prod-abc123xyz789'
encrypted_api_key = f.encrypt(api_key.encode())
recovered = f.decrypt(encrypted_api_key).decode()
print('API key recovered:', recovered == api_key)  # True

# Use HASHING for passwords (never need original, only verify):
salt = os.urandom(32)
pwd_hash = hashlib.sha256(salt + b'user_password').hexdigest()
# Cannot recover 'user_password' from pwd_hash - that's the point!

decision_table = {
    'passwords':          'HASH (argon2)',
    'user email (GDPR)':  'ENCRYPT (Fernet) - need to email them',
    'API keys':           'ENCRYPT (Fernet) - need to use them',
    'credit cards':       'ENCRYPT (Fernet) or tokenize',
    'session tokens':     'HMAC-sign (no need for confidentiality)',
    'file checksums':     'HASH (SHA-256)',
}
for data, method in decision_table.items():
    print(f'{data:25}: {method}')
```
This is called **hashing versus encryption**. The output proves that we can choose different cryptographic strategies based on whether we ever need the original value back.

### Discard the throwaway
This throwaway code is discarded and will not be used in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are adding mock data models.
- **Files affected:** `app.py`
- **Change type:** add
- **Location:** Below `fernet_client` in `app.py`.
- **Dependencies:** None.

### The New Code
```python
def save_user_data(email: str):
    encrypted_email = fernet_client.encrypt(email.encode())
    return encrypted_email
```

### The Updated Project
```python
7: fernet_client = setup_encryption() 
8:
9: def save_user_data(email: str): # ← new
10:     encrypted_email = fernet_client.encrypt(email.encode())
11:     return encrypted_email
```
We now have a function that encrypts an email address for safe storage because we will need to decrypt it later.

### Mechanical walkthrough
1. `def save_user_data(email: str):` defines the function.
2. `email.encode()` turns the string into bytes, which Fernet requires.
3. `fernet_client.encrypt(...)` generates the ciphertext token.
4. `return encrypted_email` yields the safe value to store.

### CS lens
A hash is a one-way mathematical function. Finding the input from the output is computationally infeasible. Encryption is a two-way function designed specifically to be reversed given the correct key. 

### SE lens
Categorizing data by its recovery requirements is a critical data governance step. Storing passwords with reversible encryption is a critical vulnerability.

### Commands needed
None

### Run it
`python app.py`

### One sentence connecting to previous unit
If our single encryption key is compromised, we need a way to change it without losing all our data.

## Concept Unit: Key rotation with MultiFernet

### The Problem
Keys leak. If you have only one key and you need to replace it, you can't immediately decrypt your old data. How do we transition to a new key gracefully?

### Introduce the concept in isolation
```python
from cryptography.fernet import Fernet, MultiFernet

old_key = Fernet.generate_key()
new_key = Fernet.generate_key()
old_fernet = Fernet(old_key)
new_fernet = Fernet(new_key)

old_ciphertext = old_fernet.encrypt(b'secret data')

# MultiFernet: decrypts with any key, encrypts with first key
multi = MultiFernet([new_fernet, old_fernet])  # new first = current

decrypted = multi.decrypt(old_ciphertext)
print('Old ciphertext decrypted:', decrypted)  # b'secret data'

new_ciphertext = multi.encrypt(b'secret data')
print('Same key?', old_ciphertext == new_ciphertext)  # False (different key)

print('MultiFernet.rotate(): re-encrypts old token with new key:')
rotated = multi.rotate(old_ciphertext)
print('Rotated decryptable with new only:', Fernet(new_key).decrypt(rotated))
```
This is called **key rotation**. The output proves `MultiFernet` seamlessly falls back to older keys for decryption, while exclusively using the new key for encryption.

### Discard the throwaway
This throwaway code is discarded and will not be used in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are upgrading our cipher instance.
- **Files affected:** `app.py`
- **Change type:** replace
- **Location:** inside `setup_encryption`
- **Dependencies:** None.

### The New Code
```python
from cryptography.fernet import MultiFernet

def setup_encryption():
    old_key = Fernet.generate_key()
    new_key = Fernet.generate_key()
    return MultiFernet([Fernet(new_key), Fernet(old_key)])
```

### The Updated Project
```python
1: from cryptography.fernet import Fernet, MultiFernet # ← new
2: 
3: def setup_encryption():
4:     old_key = Fernet.generate_key() # ← new
5:     new_key = Fernet.generate_key() # ← new
6:     return MultiFernet([Fernet(new_key), Fernet(old_key)]) # ← new
7: 
8: fernet_client = setup_encryption() 
```
We replaced the single `Fernet` instance with a `MultiFernet` capable of handling key rotation seamlessly.

### Mechanical walkthrough
1. `MultiFernet` is imported.
2. `old_key` and `new_key` simulate possessing a historical and current key.
3. `[Fernet(new_key), Fernet(old_key)]` creates an ordered list where the newest key is first.
4. `MultiFernet(...)` wraps them, exposing the exact same `.encrypt()` and `.decrypt()` API as a normal `Fernet`.

### CS lens
`MultiFernet` acts as a proxy/facade. On decryption, it attempts keys sequentially until one succeeds (or all fail). On encryption, it strictly uses index 0. This O(N) decryption time is acceptable because N (the number of active keys) is very small.

### SE lens
Key rotation is a compliance requirement (e.g., SOC2). A rotation event means injecting the new key into the environment variables, restarting the app, and then running a background job to `multi.rotate()` all old records in the database.

### Commands needed
None

### Run it
`python app.py`

### One sentence connecting to previous unit
Sometimes the data we encrypt isn't for long-term storage, but for a temporary action like a magic login link.

## Concept Unit: Fernet with time-limited tokens

### The Problem
If we send a user an email verification link containing encrypted data, we don't want that link to work forever. How do we securely expire an encrypted payload?

### Introduce the concept in isolation
```python
from cryptography.fernet import Fernet, InvalidToken
import time

key = Fernet.generate_key()
f = Fernet(key)

token = f.encrypt(b'email=alice@example.com')

try:
    data = f.decrypt(token, ttl=3600)  # valid for 1 hour
    print('Valid token data:', data)
except InvalidToken:
    print('Token expired or tampered!')

def verify_email_token(token: str, max_age=86400) -> str | None:
    try:
        data = f.decrypt(token.encode(), ttl=max_age)
        return data.decode()
    except InvalidToken:
        return None

token_str = f.encrypt(b'carol@example.com').decode()
print('Recovered email:', verify_email_token(token_str))
print('Expired check:', verify_email_token(token_str, max_age=0))  # None
```
This is called **time-limited encryption**. The output proves that Fernet natively embeds a timestamp, allowing it to reject tokens that are older than the specified Time-To-Live (TTL).

### Discard the throwaway
This throwaway code is discarded and will not be used in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are adding verification logic.
- **Files affected:** `app.py`
- **Change type:** add
- **Location:** Below `save_user_data`.
- **Dependencies:** None.

### The New Code
```python
from cryptography.fernet import InvalidToken

def read_user_data(token: bytes, max_age: int = 3600):
    try:
        return fernet_client.decrypt(token, ttl=max_age).decode()
    except InvalidToken:
        return None
```

### The Updated Project
```python
9: def save_user_data(email: str):
10:     encrypted_email = fernet_client.encrypt(email.encode())
11:     return encrypted_email
12: 
13: def read_user_data(token: bytes, max_age: int = 3600): # ← new
14:     try:
15:         return fernet_client.decrypt(token, ttl=max_age).decode()
16:     except InvalidToken:
17:         return None
```
We now have a safe read function that will refuse to decrypt data if the ciphertext was generated more than an hour ago.

### Mechanical walkthrough
1. `from cryptography.fernet import InvalidToken` imports the exception class.
2. `def read_user_data(token: bytes, max_age: int = 3600):` defines the function.
3. `fernet_client.decrypt(token, ttl=max_age)` attempts decryption and timestamp validation.
4. `.decode()` converts the resulting bytes back to a string.
5. `except InvalidToken:` catches tampering, wrong keys, AND expired timestamps, returning `None`.

### CS lens
Fernet tokens contain an unencrypted, but authenticated, 64-bit Unix timestamp at the start of the token. When `ttl` is provided, `decrypt` reads this timestamp. Because the timestamp is covered by the HMAC signature, an attacker cannot forge or alter the timestamp to bypass the TTL check.

### SE lens
Using embedded TTLs avoids needing a database table just to track token expiration times. This makes features like magic links and password resets entirely stateless.

### Commands needed
None

### Run it
`python app.py`

### One sentence connecting to previous unit
We've been generating keys randomly on startup, but in a real app, the key must be permanent and stored securely outside the source code.

## Concept Unit: Storing the Fernet key securely

### The Problem
If we generate a new key every time the app starts, we can never read the data we encrypted yesterday. If we hardcode the key in the file, anyone who sees the source code can decrypt our database. Where does the key go?

### Introduce the concept in isolation
```python
import os
from cryptography.fernet import Fernet
from dotenv import load_dotenv

# Simulate loading from a .env file:
os.environ['FERNET_KEY'] = Fernet.generate_key().decode()

fernet_key = os.environ.get('FERNET_KEY')
if not fernet_key:
    raise RuntimeError('FERNET_KEY environment variable not set!')

f = Fernet(fernet_key.encode())
print('Key loaded from environment. Length:', len(fernet_key))
```
This is called **environment variable configuration**. The output proves that keys can be injected into the program's runtime environment, keeping them completely decoupled from the source code.

### Discard the throwaway
This throwaway code is discarded and will not be used in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are externalizing configuration.
- **Files affected:** `app.py`
- **Change type:** refactor
- **Location:** `setup_encryption`
- **Dependencies:** None.

### The New Code
```python
import os

def setup_encryption():
    key = os.environ.get('FERNET_KEY')
    if not key:
        raise RuntimeError("Missing FERNET_KEY")
    return Fernet(key.encode())
```

### The Updated Project
```python
3: import os # ← new
4:
5: def setup_encryption():
6:     key = os.environ.get('FERNET_KEY') # ← new
7:     if not key:
8:         raise RuntimeError("Missing FERNET_KEY")
9:     return Fernet(key.encode()) # ← new
```
Our app now demands the key be provided by the operating system environment. It will crash immediately on startup if the key is missing, which is a desirable fail-fast behavior.

### Mechanical walkthrough
1. `import os` provides access to system variables.
2. `os.environ.get('FERNET_KEY')` fetches the value injected by the host.
3. `if not key: raise RuntimeError("Missing FERNET_KEY")` explicitly crashes the app instead of silently failing later.
4. `Fernet(key.encode())` converts the string back to bytes for the Fernet constructor.

### CS lens
This adheres to the Twelve-Factor App methodology: strictly separating configuration (which varies between deployments) from code (which does not).

### SE lens
Secret management is a critical security domain. Hardcoding secrets in git is the number one cause of enterprise data breaches. By using `os.environ`, the application can be safely given keys via AWS Secrets Manager, Kubernetes Secrets, or a `.env` file (which must be in `.gitignore`) without changing the code.

### Commands needed
None

### Run it
`python app.py` (Note: This will crash unless you set the environment variable first!)

### One sentence connecting to previous unit
We have now established a complete, secure pipeline for managing sensitive data using symmetric encryption.

## Closing

### Connect the pieces
When handling user data, always ask: "Do I need the original value?" If no (passwords), use hashing. If yes (emails, API keys), use encryption. We learned that `cryptography.fernet.Fernet` provides AES-128-CBC + HMAC-SHA256, protecting both confidentiality and integrity. We saw how `MultiFernet` enables zero-downtime key rotation, how TTLs handle expiring tokens statelessly, and how `os.environ` keeps keys out of source control. Tracing the full lifecycle: `f.encrypt(b'alice@example.com')` embeds a timestamp and generates a ciphertext; later, `f.decrypt(ciphertext)` safely recovers `b'alice@example.com'` to send a GDPR export, all while keeping the secret key securely in the environment, never in the code.
