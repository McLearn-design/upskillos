# Lesson 17: HMAC — Message Authentication, Signed Tokens, and Timing-Safe Comparison

What you will build
In this lesson, you will learn how to use HMAC (Hash-based Message Authentication Code) to verify that a message was created by an entity possessing a secret key, and that the message has not been altered. You will build the foundation for signed cookies, CSRF (Cross-Site Request Forgery) protection, and secure password reset tokens. The transferable insight is that HMAC combines a hash function with a secret key to provide both data integrity and authentication.

What you need to know first
- Nothing.

Terms used in this lesson
- **HMAC (Hash-based Message Authentication Code)** — A specific type of message authentication code involving a cryptographic hash function and a secret cryptographic key. It is used to verify both the data integrity and the authenticity of a message.
- **CSRF (Cross-Site Request Forgery)** — An attack that forces an authenticated end-user to execute unwanted actions on a web application in which they are currently authenticated.
- **Timing attack** — A side-channel attack where an attacker attempts to compromise a cryptosystem by analyzing the time taken to execute cryptographic algorithms or string comparisons.
- **Base64url encoding** — A variant of Base64 encoding that uses URL-safe and filename-safe characters (`-` and `_` instead of `+` and `/`), and omits padding characters, making it suitable for embedding in URLs and tokens without requiring URL-encoding.
- **Entropy** — A measure of the randomness or unpredictability of data. Cryptographic systems rely on high-entropy sources to generate keys that cannot be guessed or brute-forced.
- **CSPRNG (Cryptographically Secure Pseudo-Random Number Generator)** — A pseudo-random number generator with properties that make it suitable for use in cryptography, typically drawing randomness from the operating system.

Objects and methods used

**hmac.new**
- *What it is:* A function to create a new HMAC object.
- *Implementation:* `hmac.new(key: bytes, msg: bytes = None, digestmod: str | callable = '') -> HMAC`
- *Its use:* To generate an HMAC for a given message using a secret key, ensuring the message cannot be forged without the key.
- *Type:* Standard library function.
- *Responsibility:* Computes the HMAC of a message using a secret key and a specified hash algorithm, implementing the two-pass HMAC construction.
- *Depends on:* A secret key (bytes), an optional message (bytes), and a cryptographic hash module (e.g., `hashlib.sha256`).
- *Connects to:* Called by application code generating or verifying signed tokens; relies on the `hashlib` module internally.
- *Shape:* A cryptographic utility function called at the application's boundary where data is serialized for the client.

**hmac.compare_digest**
- *What it is:* A function to compare two strings or byte-like objects in constant time.
- *Implementation:* `hmac.compare_digest(a: AnyStr, b: AnyStr) -> bool`
- *Its use:* To safely compare a received HMAC against an expected HMAC without being vulnerable to timing attacks.
- *Type:* Standard library function.
- *Responsibility:* Performs a byte-by-byte comparison of two sequences, taking the same amount of time regardless of where the first mismatched byte occurs.
- *Depends on:* Two sequences of bytes or strings to compare.
- *Connects to:* Called during the verification phase of any cryptographic token checking.
- *Shape:* A security-critical utility used anywhere secrets or MACs are compared.

**hashlib.sha256**
- *What it is:* A constructor for the SHA-256 hash object.
- *Implementation:* `hashlib.sha256(data: bytes = b'') -> Hash`
- *Its use:* Passed as the `digestmod` argument to `hmac.new` to specify the underlying hash function.
- *Type:* Standard library hash object constructor.
- *Responsibility:* Computes a 256-bit secure hash of the input data.
- *Depends on:* The byte data to be hashed.
- *Connects to:* Used internally by `hmac.new` to perform the inner and outer hash passes.
- *Shape:* A cryptographic primitive provided by the standard library.

**secrets.token_bytes**
- *What it is:* A function to generate cryptographically strong random bytes.
- *Implementation:* `secrets.token_bytes(nbytes: int = None) -> bytes`
- *Its use:* To generate secure random secret keys for HMAC operations.
- *Type:* Standard library function.
- *Responsibility:* Retrieves high-entropy random bytes from the operating system's CSPRNG (like `os.urandom`).
- *Depends on:* The number of bytes requested.
- *Connects to:* Calls the underlying OS randomness source; provides bytes used as keys by `hmac.new`.
- *Shape:* A foundational utility for generating cryptographic secrets.

**secrets.token_hex**
- *What it is:* A function to generate a cryptographically strong random text string, in hexadecimal.
- *Implementation:* `secrets.token_hex(nbytes: int = None) -> str`
- *Its use:* To generate printable, secure random tokens (like CSRF tokens).
- *Type:* Standard library function.
- *Responsibility:* Generates `nbytes` of random bytes and converts them to a hexadecimal string.
- *Depends on:* The number of bytes requested.
- *Connects to:* Uses `secrets.token_bytes` internally and formats the output.
- *Shape:* A utility for generating human-readable or transport-safe secrets.

**secrets.token_urlsafe**
- *What it is:* A function to generate a URL-safe random text string.
- *Implementation:* `secrets.token_urlsafe(nbytes: int = None) -> str`
- *Its use:* To generate secure random tokens that can be embedded directly in URLs.
- *Type:* Standard library function.
- *Responsibility:* Generates `nbytes` of random bytes and encodes them using Base64url encoding.
- *Depends on:* The number of bytes requested.
- *Connects to:* Uses `secrets.token_bytes` and `base64` internally.
- *Shape:* A utility for generating URL-safe authentication or identification tokens.

**base64.urlsafe_b64encode**
- *What it is:* A function to encode bytes into a URL-safe Base64 string.
- *Implementation:* `base64.urlsafe_b64encode(s: bytes) -> bytes`
- *Its use:* To encode binary data (like a JSON payload or an HMAC digest) into a string safe for HTTP headers or URLs.
- *Type:* Standard library function.
- *Responsibility:* Converts arbitrary binary data into a restricted character set (`A-Z`, `a-z`, `0-9`, `-`, `_`).
- *Depends on:* The bytes to encode.
- *Connects to:* Called during token serialization.
- *Shape:* A data formatting utility.

**base64.urlsafe_b64decode**
- *What it is:* A function to decode a URL-safe Base64 string back into bytes.
- *Implementation:* `base64.urlsafe_b64decode(s: bytes | str) -> bytes`
- *Its use:* To decode the components of a received token back into binary form for verification.
- *Type:* Standard library function.
- *Responsibility:* Reverses the URL-safe Base64 encoding.
- *Depends on:* The encoded string or bytes.
- *Connects to:* Called during token parsing and deserialization.
- *Shape:* A data parsing utility at the application boundary.

**time.time**
- *What it is:* A function returning the current time in seconds since the Epoch.
- *Implementation:* `time.time() -> float`
- *Its use:* To generate and check expiration timestamps for tokens.
- *Type:* Standard library function.
- *Responsibility:* Provides the current absolute time.
- *Depends on:* The operating system's system clock.
- *Connects to:* Used by token generation and validation logic to handle time-to-live.
- *Shape:* A system utility providing temporal context.

**Flask**
- *What it is:* The central application object in the Flask web framework.
- *Implementation:* `Flask(import_name: str)`
- *Its use:* To encapsulate the web application and its configuration.
- *Type:* Framework core class.
- *Responsibility:* Manages routing, configuration, and the request/response cycle.
- *Depends on:* An import name (typically `__name__`).
- *Connects to:* Orchestrates the entire web application flow.
- *Shape:* The root object of the web framework.

**session**
- *What it is:* A proxy to the current request's session object in Flask.
- *Implementation:* A context-local proxy behaving like a dictionary.
- *Its use:* To store the user's specific CSRF token material across requests.
- *Type:* Framework proxy object.
- *Responsibility:* Provides read/write access to session data, typically serialized into a signed cookie.
- *Depends on:* An active request context and the application's `SECRET_KEY`.
- *Connects to:* Reads from and writes to the HTTP `Cookie` header via Flask's internal session interface.
- *Shape:* A data store bound to the current user's interaction session.

## Concept Unit: The hmac module

### The Problem
When you send data to a client (like a user ID in a cookie), you need a way to ensure the client hasn't modified that data when they send it back. If you just send `user_id=42`, a malicious user can change it to `user_id=1` and hijack another user's session. How do we securely prove that a piece of data was created by our server and has not been altered, without having to store every single piece of data we've ever sent out in a database?

### Introduce the concept in isolation
Here is how we use the `hmac` module to compute a Hash-based Message Authentication Code, which proves the integrity and authenticity of a message.

```python
import hmac, hashlib, secrets

# HMAC: keyed hash. Requires a secret key.
# Without key: anyone can compute SHA-256(message) -> no authentication
# With HMAC: only parties with the secret key can produce a valid MAC
SECRET_KEY = secrets.token_bytes(32)  # 256-bit random key
message = b'user_id=42&role=user'

# Compute HMAC-SHA256:
mac = hmac.new(SECRET_KEY, message, hashlib.sha256).hexdigest()
print('HMAC:', mac)
print('Length:', len(mac), 'hex chars')

# Different key -> different MAC:
wrong_key = secrets.token_bytes(32)
mac_wrong = hmac.new(wrong_key, message, hashlib.sha256).hexdigest()
print('Same message, different key:', mac_wrong[:16], '...')
print('MACs equal:', mac == mac_wrong)  # False

# Tampered message:
tampered = b'user_id=42&role=admin'  # changed role
mac_tampered = hmac.new(SECRET_KEY, tampered, hashlib.sha256).hexdigest()
print('Tampered MAC matches original:', mac == mac_tampered)  # False
```
Output (from confidence):
```text
HMAC: <64-character hex string>
Length: 64 hex chars
Same message, different key: <16-character hex string> ...
MACs equal: False
Tampered MAC matches original: False
```
This proves that altering even a single bit of the message, or using an incorrect secret key, results in a completely different HMAC digest. The server can verify a message by recomputing the HMAC with its own secret key and comparing it to the provided HMAC. This is called an **HMAC**.

### Discard the throwaway
This throwaway example is discarded and will not appear in the project again.

### Project Change
No reference counterpart — this is a from-scratch addition because we are demonstrating the core cryptographic primitive.
Files affected: `scratch/hmac_demo.py` (created)
Change type: add
Location: brand-new file
Dependencies: Python standard library

### The New Code
```python
import hmac, hashlib, secrets

SECRET_KEY = secrets.token_bytes(32)
message = b'user_id=42&role=user'
mac = hmac.new(SECRET_KEY, message, hashlib.sha256).hexdigest()
```

### The Updated Project
```python
# 1: import hmac, hashlib, secrets
# 2: 
# 3: SECRET_KEY = secrets.token_bytes(32)
# 4: message = b'user_id=42&role=user'
# 5: mac = hmac.new(SECRET_KEY, message, hashlib.sha256).hexdigest()
```
This script computes an HMAC for a byte string using a secure random key.

### Mechanical walkthrough
- `import hmac, hashlib, secrets`: Imports the necessary cryptographic modules from the standard library.
- `SECRET_KEY = secrets.token_bytes(32)`: Generates exactly 32 bytes (256 bits) of high-entropy randomness using the operating system's secure generator. This is the secret key.
- `message = b'user_id=42&role=user'`: Defines the data we want to authenticate as a raw byte string.
- `hmac.new(SECRET_KEY, message, hashlib.sha256)`: Creates a new HMAC object, combining the `SECRET_KEY` and the `message` using the `sha256` hashing algorithm. Internally, this executes the two-pass HMAC algorithm to prevent length extension attacks.
- `.hexdigest()`: Finalizes the HMAC computation and returns the digest formatted as a string of hexadecimal digits.

### CS lens
HMAC is defined in RFC 2104. It calculates `H(K XOR opad, H(K XOR ipad, text))`. A naive keyed hash like `H(key || message)` is vulnerable to length-extension attacks if the underlying hash function (like SHA-256) uses the Merkle-Damgård construction. An attacker could append data to the message and compute a valid new hash without knowing the key. HMAC's two-pass nested hashing completely eliminates this vulnerability.

### SE lens
Secret keys must be kept out of version control. In a real application, `SECRET_KEY` would be loaded from an environment variable. If the key is leaked, the attacker can forge valid MACs for any message, completely breaking the system's authentication boundary.

### Commands needed
Run: python app.py (In this unit, run the throwaway script if desired, though it's isolated).

### Run it
The code runs and produces the 64-character hexadecimal HMAC string.

### One sentence connecting to previous unit
Now that we can generate an HMAC for raw bytes, we need to apply this to structured data so we can securely transmit JSON payloads.

## Concept Unit: Signed tokens — encoding data + MAC

### The Problem
We have data (like a dictionary `{'user_id': 42, 'role': 'user'}`) and we can compute its HMAC. But how do we actually bundle the data and its HMAC together into a single, printable string that we can put in a cookie, a URL, or an HTTP header, and then reliably extract and verify it later?

### Introduce the concept in isolation
Here is how we serialize data, compute its MAC, and bundle both into a base64url-encoded signed token.

```python
import hmac, hashlib, secrets, base64, json

SECRET_KEY = b'super-secret-key-change-in-production'

def create_token(data: dict) -> str:
    payload = json.dumps(data, separators=(',', ':')).encode()
    payload_b64 = base64.urlsafe_b64encode(payload).rstrip(b'=')
    mac = hmac.new(SECRET_KEY, payload_b64, hashlib.sha256).digest()
    mac_b64 = base64.urlsafe_b64encode(mac).rstrip(b'=')
    return f'{payload_b64.decode()}.{mac_b64.decode()}'

def verify_token(token: str) -> dict | None:
    try:
        payload_b64, mac_b64 = token.split('.')
        payload_bytes = payload_b64.encode()
        expected_mac = hmac.new(SECRET_KEY, payload_bytes, hashlib.sha256).digest()
        received_mac = base64.urlsafe_b64decode(mac_b64 + '==')
        if not hmac.compare_digest(expected_mac, received_mac):
            return None  # tampered
        return json.loads(base64.urlsafe_b64decode(payload_b64 + '=='))
    except Exception:
        return None

token = create_token({'user_id': 42, 'role': 'user'})
print('Token:', token[:40], '...')
print('Verified:', verify_token(token))
print('Tampered:', verify_token(token[:-4] + 'XXXX'))  # None
```
Output (from confidence):
```text
Token: eyJ1c2VyX2lkIjo0Miwicm9sZSI6InVzZXIifQ.<mac> ...
Verified: {'user_id': 42, 'role': 'user'}
Tampered: None
```
This proves that we can encapsulate state entirely on the client, trusting it only because the HMAC signature prevents tampering. The structure `payload.mac` is a **signed token**.

### Discard the throwaway
This throwaway example is discarded and will not appear in the project again.

### Project Change
No reference counterpart — this is a from-scratch addition.
Files affected: `scratch/signed_token.py` (created)
Change type: add
Location: brand-new file
Dependencies: Python standard library

### The New Code
```python
import hmac, hashlib, base64, json

def create_token(data: dict) -> str:
    payload = json.dumps(data, separators=(',', ':')).encode()
    payload_b64 = base64.urlsafe_b64encode(payload).rstrip(b'=')
    mac = hmac.new(SECRET_KEY, payload_b64, hashlib.sha256).digest()
    mac_b64 = base64.urlsafe_b64encode(mac).rstrip(b'=')
    return f'{payload_b64.decode()}.{mac_b64.decode()}'
```

### The Updated Project
```python
# 1: import hmac, hashlib, base64, json
# 2: 
# 3: SECRET_KEY = b'super-secret-key-change-in-production'
# 4: 
# 5: def create_token(data: dict) -> str:
# 6:     payload = json.dumps(data, separators=(',', ':')).encode()
# 7:     payload_b64 = base64.urlsafe_b64encode(payload).rstrip(b'=')
# 8:     mac = hmac.new(SECRET_KEY, payload_b64, hashlib.sha256).digest()
# 9:     mac_b64 = base64.urlsafe_b64encode(mac).rstrip(b'=')
# 10:    return f'{payload_b64.decode()}.{mac_b64.decode()}'
```
This function takes a dictionary, turns it into compact JSON, encodes it, computes a signature, and bundles them into a single token separated by a dot.

### Mechanical walkthrough
- `json.dumps(data, separators=(',', ':')).encode()`: Serializes the dictionary into a JSON string with no whitespace, then encodes it into raw bytes.
- `base64.urlsafe_b64encode(payload).rstrip(b'=')`: Encodes the byte payload using base64url so it's safe for transport. The trailing `=` padding characters are stripped because they are unnecessary and ugly in URLs.
- `hmac.new(SECRET_KEY, payload_b64, hashlib.sha256).digest()`: Computes the HMAC over the *encoded* payload string. It returns the raw 32-byte digest, not a hex string.
- `base64.urlsafe_b64encode(mac).rstrip(b'=')`: Base64url-encodes the raw HMAC bytes, stripping padding.
- `return f'{payload_b64.decode()}.{mac_b64.decode()}'`: Decodes the byte sequences back to Python strings and joins them with a `.` delimiter. The dot is a safe separator because it is not part of the base64url alphabet.
- `hmac.compare_digest(expected_mac, received_mac)`: In the verification function, this compares the MACs. It operates in constant time.

### CS lens
`hmac.compare_digest` is critical because standard string equality (`==`) fails fast: it returns `False` the moment it finds a differing byte. If an attacker submits millions of guesses, they can measure exactly how long the comparison takes. If it takes slightly longer, they know they guessed the first byte correctly. They can repeat this to extract the correct MAC byte-by-byte. `compare_digest` always takes the same amount of time, closing this timing side-channel.

### SE lens
This token format (`base64(payload).base64(mac)`) is exactly how JSON Web Tokens (JWTs) work (though JWTs add a third header segment). Flask's `itsdangerous` library (which powers Flask sessions) uses an almost identical structure. By understanding this, you understand the fundamental mechanism behind stateless session management in modern web frameworks.

### Commands needed
Run: python app.py

### Run it
The code runs and produces a base64url-encoded signed token.

### One sentence connecting to previous unit
Now that we can generate tokens, we need a reliable way to generate the secret keys and random values used to secure them.

## Concept Unit: secrets module — cryptographically secure randomness

### The Problem
If we use `random.random()` or `random.choice()` to generate secret keys, tokens, or passwords, an attacker can observe a sequence of these "random" values, deduce the internal state of the random number generator, and perfectly predict all future (and past) generated secrets. How do we generate randomness that is mathematically unpredictable?

### Introduce the concept in isolation
Here is how we use Python's `secrets` module to generate cryptographically secure randomness.

```python
import secrets, string, hmac

# secrets: uses OS CSPRNG (os.urandom internally)
# Use for: secret keys, tokens, CSRF tokens, password reset links
# Never use: random.random(), random.randint() for security

# Token bytes:
token_32 = secrets.token_bytes(32)       # 32 random bytes
token_hex = secrets.token_hex(32)        # 64 hex chars
token_url = secrets.token_urlsafe(32)    # 43 base64url chars (no +, /, =)
print('token_bytes:', token_32[:8].hex(), '...')
print('token_hex:', token_hex[:16], '...')
print('token_urlsafe:', token_url[:16], '...')

# Choose from alphabet:
password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(16))
print('Random password:', password)

# Compare for equality:
a = secrets.token_hex(32)
b = a  # same
print('Timing-safe equal:', hmac.compare_digest(a, b))  # True
print('Entropy: token_urlsafe(32) has', 32*8, 'bits = 2^256 possibilities')
```
Output (from confidence):
```text
token_bytes: <hex> ...
token_hex: <hex> ...
token_urlsafe: <base64url> ...
Random password: <16 random chars>
Timing-safe equal: True
Entropy: token_urlsafe(32) has 256 bits = 2^256 possibilities
```
This proves that we can extract arbitrary amounts of high-quality randomness in various formats safely. This is the **secrets** module.

### Discard the throwaway
This throwaway example is discarded and will not appear in the project again.

### Project Change
No reference counterpart — this is a from-scratch addition.
Files affected: `scratch/secrets_demo.py` (created)
Change type: add
Location: brand-new file
Dependencies: Python standard library

### The New Code
```python
import secrets, string

token_url = secrets.token_urlsafe(32)
password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(16))
```

### The Updated Project
```python
# 1: import secrets, string
# 2: 
# 3: token_url = secrets.token_urlsafe(32)
# 4: password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(16))
```
This code generates a safe URL token and a random password.

### Mechanical walkthrough
- `secrets.token_urlsafe(32)`: Requests 32 bytes of secure randomness from the operating system, encodes it in base64url, and returns it as a string. Note that 32 is the number of underlying *bytes*, not the length of the resulting string (which will be ~43 characters).
- `secrets.choice(string.ascii_letters + string.digits)`: Picks a single character from the provided string (a-z, A-Z, 0-9) using the secure random generator.
- `''.join(...) for _ in range(16)`: A generator expression that loops 16 times, picking a random character each time, and joins them into a single string.

### CS lens
The standard `random` module uses the Mersenne Twister algorithm. It is statistically excellent (good for simulations) but cryptographically broken: observing 624 outputs allows an attacker to clone the internal state and predict all future numbers. The `secrets` module delegates to `os.urandom()`, which reads from the operating system's CSPRNG (Cryptographically Secure Pseudo-Random Number Generator). The OS constantly collects entropy (unpredictability) from hardware interrupts, CPU jitter, and mouse movements to seed this pool, making it computationally infeasible to predict.

### SE lens
Hardcoding `SECRET_KEY = "my_secret_key"` in code makes it identical across all installations and easily compromised if the source code leaks. Best practice is to generate a random key once on deployment using `secrets.token_hex(32)` and inject it via an environment variable.

### Commands needed
Run: python app.py

### Run it
The code runs and produces random output.

### One sentence connecting to previous unit
Now that we have secure randomness and HMACs, we can combine them to protect our application from Cross-Site Request Forgery.

## Concept Unit: CSRF token implementation

### The Problem
If a user is logged into your bank, their browser automatically sends their session cookie with every request to the bank. A malicious site (evil.com) can include a hidden form that submits a POST request to `bank.com/transfer`. The browser attaches the cookie, and the bank processes the transfer, thinking the user authorized it. How do we ensure that state-changing requests originated from our actual frontend application, not a malicious third-party site?

### Introduce the concept in isolation
We solve this by requiring a secret CSRF token to be submitted alongside the form data. We generate a random session token, and then use HMAC to bind a CSRF token to that session.

```python
import hmac, hashlib, secrets
from flask import Flask, session, request

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)
SECRET = app.config['SECRET_KEY'].encode()

def generate_csrf_token():
    # Tie CSRF token to user's session token (not random standalone)
    session_token = session.get('token', secrets.token_hex(16))
    session['token'] = session_token
    mac = hmac.new(SECRET, session_token.encode(), hashlib.sha256).hexdigest()[:32]
    return f'{session_token}.{mac}'

def validate_csrf_token(submitted_token):
    try:
        submitted_session, submitted_mac = submitted_token.split('.')
        stored_session = session.get('token')
        if not stored_session or submitted_session != stored_session:
            return False
        expected_mac = hmac.new(SECRET, stored_session.encode(), hashlib.sha256).hexdigest()[:32]
        return hmac.compare_digest(expected_mac, submitted_mac)
    except Exception:
        return False

with app.test_request_context():
    token = generate_csrf_token()
    print('CSRF token:', token[:20], '...')
    print('Valid:', validate_csrf_token(token))   # True
    print('Forged:', validate_csrf_token('fake.0000000000000000'))  # False
```
Output (from confidence):
```text
CSRF token: <session_token>.<mac> ...
Valid: True
Forged: False
```
This proves that an attacker cannot forge a valid request. They must submit the token, but because they cannot read the user's cookies (due to Same-Origin Policy) and they don't know the server's `SECRET_KEY`, they cannot compute the correct MAC to create a valid **CSRF Token**.

### Discard the throwaway
This throwaway example is discarded and will not appear in the project again.

### Project Change
No reference counterpart — this is a from-scratch addition.
Files affected: `scratch/csrf_demo.py` (created)
Change type: add
Location: brand-new file
Dependencies: Python standard library, Flask

### The New Code
```python
def generate_csrf_token():
    session_token = session.get('token', secrets.token_hex(16))
    session['token'] = session_token
    mac = hmac.new(SECRET, session_token.encode(), hashlib.sha256).hexdigest()[:32]
    return f'{session_token}.{mac}'
```

### The Updated Project
```python
# 1: def generate_csrf_token():
# 2:     session_token = session.get('token', secrets.token_hex(16))
# 3:     session['token'] = session_token
# 4:     mac = hmac.new(SECRET, session_token.encode(), hashlib.sha256).hexdigest()[:32]
# 5:     return f'{session_token}.{mac}'
```
This generates a CSRF token bound to the current session using an HMAC.

### Mechanical walkthrough
- `session.get('token', secrets.token_hex(16))`: Retrieves the existing random token from the Flask `session` object. If none exists (e.g., first visit), it generates a new 16-byte hex string.
- `session['token'] = session_token`: Saves the token back to the session. Flask stores this securely in a signed cookie on the user's browser.
- `hmac.new(SECRET, session_token.encode(), ...).hexdigest()[:32]`: Computes the HMAC of the session token using the server's secret key. We slice `[:32]` to truncate the MAC to 32 characters, which is secure enough for CSRF while keeping the token shorter.
- `return f'{session_token}.{mac}'`: The final CSRF token is the session token and its MAC, separated by a dot.
- `validate_csrf_token`: In validation, the token is split. We verify that the submitted session token matches the one in the secure cookie (`session.get('token')`). Then we recompute the MAC on the server and use `hmac.compare_digest` to verify the signature.

### CS lens
Why use an HMAC here instead of just generating a random token and saving it in the session? If the CSRF token is just a random string, some architectures (like double-submit cookies) require storing it in a cookie and checking it against a submitted form field. By using HMAC, the token itself proves it was issued by the server and bound to this specific session identifier, moving the cryptographic guarantee entirely to the signature validation step.

### SE lens
Cross-Site Request Forgery is largely mitigated in modern browsers by the `SameSite=Lax` cookie attribute, which prevents cookies from being sent on cross-site POST requests. However, implementing a CSRF token remains a critical defense-in-depth measure, especially for older browsers or APIs where SameSite configurations might be misconfigured or bypassed.

### Commands needed
Run: python app.py

### Run it
The code executes, successfully validating the genuine token and rejecting the forged one.

### One sentence connecting to previous unit
Beyond protecting form submissions, HMAC tokens can be used to safely delegate access over time, such as for password resets.

## Concept Unit: Password reset tokens with expiry

### The Problem
When a user forgets their password, you need to send them a link allowing them to reset it. This link must identify the user, prove that it was generated by your server, and expire after a short period (e.g., 1 hour). How do we embed temporal validity and identity into a stateless string?

### Introduce the concept in isolation
We combine the user ID and an expiration timestamp into a payload, and sign the entire payload with an HMAC.

```python
import hmac, hashlib, secrets, time
from flask import Flask

app = Flask(__name__)
SECRET = b'change-me-in-production'

def make_reset_token(user_id: int) -> str:
    expires = int(time.time()) + 3600  # 1 hour from now
    payload = f'{user_id}:{expires}'
    mac = hmac.new(SECRET, payload.encode(), hashlib.sha256).hexdigest()[:32]
    return f'{payload}:{mac}'

def verify_reset_token(token: str):
    try:
        parts = token.split(':')
        if len(parts) != 3:
            return None
        user_id_str, expires_str, received_mac = parts
        
        payload = f'{user_id_str}:{expires_str}'
        expected_mac = hmac.new(SECRET, payload.encode(), hashlib.sha256).hexdigest()[:32]
        
        if not hmac.compare_digest(expected_mac, received_mac):
            return None  # tampered
            
        if int(expires_str) < time.time():
            return None  # expired
            
        return int(user_id_str)
    except (ValueError, Exception):
        return None

token = make_reset_token(user_id=42)
print('Reset token:', token)
print('Verified user_id:', verify_reset_token(token))  # 42
print('Tampered:', verify_reset_token(token[:-4]+'XXXX'))  # None
```
Output (from confidence):
```text
Reset token: 42:1700000000:<mac>
Verified user_id: 42
Tampered: None
```
This proves we can create self-validating, time-bound credentials without touching a database. This is a **Password reset token**.

### Discard the throwaway
This throwaway example is discarded and will not appear in the project again.

### Project Change
No reference counterpart — this is a from-scratch addition.
Files affected: `scratch/reset_token_demo.py` (created)
Change type: add
Location: brand-new file
Dependencies: Python standard library

### The New Code
```python
def make_reset_token(user_id: int) -> str:
    expires = int(time.time()) + 3600
    payload = f'{user_id}:{expires}'
    mac = hmac.new(SECRET, payload.encode(), hashlib.sha256).hexdigest()[:32]
    return f'{payload}:{mac}'
```

### The Updated Project
```python
# 1: def make_reset_token(user_id: int) -> str:
# 2:     expires = int(time.time()) + 3600
# 3:     payload = f'{user_id}:{expires}'
# 4:     mac = hmac.new(SECRET, payload.encode(), hashlib.sha256).hexdigest()[:32]
# 5:     return f'{payload}:{mac}'
```
This function builds a token encapsulating a user ID and an expiration time, signed to prevent tampering.

### Mechanical walkthrough
- `int(time.time()) + 3600`: Gets the current system time in seconds since the Unix epoch, and adds 3600 seconds (1 hour). This is the absolute timestamp when the token expires.
- `payload = f'{user_id}:{expires}'`: Constructs a clear-text payload combining the identity and the expiry time, separated by a colon.
- `hmac.new(SECRET, payload.encode(), hashlib.sha256).hexdigest()[:32]`: Signs the payload string. We encode it to bytes, compute the MAC, hex-encode it, and truncate to 32 characters.
- `return f'{payload}:{mac}'`: Returns a three-part string `user_id:expires:mac`.
- `verify_reset_token`: During verification, it splits the string into 3 parts. Crucially, it reconstructs the expected payload and verifies the MAC *before* trusting the expiration time. Only if the MAC is valid does it check `int(expires_str) < time.time()`.

### CS lens
This relies on the principle of authenticated data structures. The attacker can clearly see the expiration time in the token. They might try to extend it by changing `1700003600` to `1900000000`. However, modifying the payload changes the input to the HMAC function. Without the `SECRET_KEY`, they cannot compute the new valid MAC for their modified payload. The server rejects the token because the MAC mismatch proves tampering.

### SE lens
While this is extremely efficient because it requires no database lookups, it has one major drawback: revocation. Because the token is self-validating, you cannot easily invalidate it before the 1 hour expires. If a user resets their password, the token remains valid and could theoretically be used again within that hour. A common hybrid approach includes a hash of the user's current password hash in the payload; when the password changes, the token's payload inherently changes, instantly invalidating the old token.

### Commands needed
Run: python app.py

### Run it
The code executes, successfully validating the token and returning the correct user ID.

### One sentence connecting to previous unit
By combining HMAC with expiration times and user identities, we've built a robust primitive for stateless authentication flows.

## Closing

### Connect the pieces
Trace the generation and use of a password reset link: A user with `user_id=7` requests a reset. `make_reset_token` calculates `expires=now+3600` (e.g., `1700003600`). It constructs the payload `7:1700003600`. It then computes `HMAC(SECRET, payload)[:32]`, resulting in a signature like `a3f9...`. The final token is `7:1700003600:a3f9...`. This token is emailed to the user as part of a link. When the user clicks the link, `verify_reset_token` receives the string. It splits it, recomputes the HMAC on `7:1700003600` using the server's `SECRET_KEY`, and uses `compare_digest` to perform a timing-safe equality check. If it matches, the data is trusted. It then checks the expiry against the current `time.time()`. If valid, it returns `7`, allowing the application to securely change the password for user 7. Through this, we see how HMAC, secure randomness, and constant-time comparisons interlock to create robust web security primitives.
