# Lesson 19: Secret Keys and .env — os.environ, python-dotenv, and the 12-Factor App

## What you will build
You will integrate environment variables into a Flask application to manage configuration separately from code. The application will use `os.environ` to read system environment variables and `python-dotenv` to load local secrets from a `.env` file. You will generate a stable cryptographic secret for session management and organize configurations into environment-specific classes, ensuring that production settings are driven by the environment rather than hardcoded values.

## What you need to know first
- Nothing.

## Terms used in this lesson
- **Configuration** — The settings and parameters that dictate how an application behaves in a specific environment. Separating configuration from code allows the same codebase to run in development, staging, and production.
- **Environment Variable** — A key-value pair maintained by the operating system that affects the behavior of running processes. It solves the problem of passing configuration to an application without modifying its code.
- **12-Factor App** — A methodology for building software-as-a-service apps. Its third factor dictates that configuration should be stored in the environment.
- **Environment** — The context in which an application runs, such as a local development machine, a continuous integration server, or a production host.

## Objects and methods used

**`os.environ`**
- *What it is:* A mapping object representing the string environment.
- *Implementation:* `os.environ` is a mapping-like dictionary defined in the `os` module.
- *Its use:* To access environment variables provided by the operating system.
- *Type:* A mapping object (dictionary-like).
- *Responsibility:* Provides an interface to read and write environment variables for the current process.
- *Depends on:* The underlying operating system's environment variables.
- *Connects to:* Accessed by application code to read configuration; modified variables are passed to child processes.
- *Shape:* A global mapping interface at the OS boundary.

**`os.environ.get()`**
- *What it is:* A method to retrieve the value of an environment variable.
- *Implementation:* `get(key, default=None)` method on the `os.environ` mapping.
- *Its use:* To safely retrieve environment variables with an optional default value, avoiding a `KeyError` if the key is missing.
- *Type:* Instance method of a mapping object.
- *Responsibility:* Returns the value for a key if it exists, otherwise returns a default value.
- *Depends on:* The `os.environ` mapping and the specified key.
- *Connects to:* Called by application code to read optional configuration variables.
- *Shape:* A standard dictionary access method used to safely extract configuration.

**`load_dotenv()`**
- *What it is:* A function from the `python-dotenv` package that loads environment variables from a `.env` file.
- *Implementation:* `load_dotenv(dotenv_path=None, stream=None, verbose=False, override=False, interpolate=True, encoding='utf-8')`
- *Its use:* To populate `os.environ` with secrets and configuration during local development without committing them to version control.
- *Type:* Standalone function.
- *Responsibility:* Reads a file containing key-value pairs and sets them as environment variables in the current process if they are not already set.
- *Depends on:* The presence of a `.env` file (by default in the current directory) and the `os.environ` mapping.
- *Connects to:* Called at application startup; writes to `os.environ`.
- *Shape:* An initialization boundary function that bridges local files into the process environment.

**`Flask`**
- *What it is:* The core application class of the Flask web framework.
- *Implementation:* `class Flask(import_name, ...)`
- *Its use:* To create the WSGI application instance.
- *Type:* Class.
- *Responsibility:* Serves as the central registry for configuration, routes, and extensions.
- *Depends on:* An import name (usually `__name__`).
- *Connects to:* Receives requests from the WSGI server, applies configuration from `app.config`, and routes to view functions.
- *Shape:* The primary framework object and application container.

**`app.config`**
- *What it is:* A dictionary-like object attached to the Flask application instance holding configuration variables.
- *Implementation:* `flask.config.Config` which subclasses `dict`.
- *Its use:* To store application-wide settings such as `SECRET_KEY` and `DEBUG`.
- *Type:* Instance attribute of type `Config` (dictionary subclass).
- *Responsibility:* Manages configuration keys and values, providing methods to load them from various sources.
- *Depends on:* The Flask application instance.
- *Connects to:* Read by Flask extensions and internals; modified by application setup code.
- *Shape:* A central registry of configuration state.

**`app.config.update()`**
- *What it is:* A method to bulk-update configuration settings.
- *Implementation:* `update([E, ]**F)` - standard dictionary update method.
- *Its use:* To apply multiple configuration variables at once from environment variables.
- *Type:* Instance method of a dictionary subclass.
- *Responsibility:* Updates the configuration dictionary with key-value pairs from another dictionary or iterable.
- *Depends on:* The `app.config` object and a dictionary of new settings.
- *Connects to:* Called during application setup to inject environment-driven configuration.
- *Shape:* A state-mutating method on the central configuration registry.

**`secrets.token_hex()`**
- *What it is:* A function to generate a secure random text string in hexadecimal.
- *Implementation:* `secrets.token_hex(nbytes=None)`
- *Its use:* To generate a cryptographically strong `SECRET_KEY` for signing Flask session cookies.
- *Type:* Standalone function in the standard library.
- *Responsibility:* Generates a random string containing `nbytes` random bytes converted to hexadecimal.
- *Depends on:* The operating system's cryptographic random number generator.
- *Connects to:* Called once by an administrator to generate a key; the output is saved to the environment.
- *Shape:* A cryptographic utility function.

**`app.config.from_object()`**
- *What it is:* A method to load configuration from a Python class or object.
- *Implementation:* `from_object(obj)`
- *Its use:* To apply environment-specific configuration classes (like `DevelopmentConfig` or `ProductionConfig`) to the application.
- *Type:* Instance method of the `flask.config.Config` class.
- *Responsibility:* Iterates over the uppercase attributes of the provided object and sets them in the configuration dictionary.
- *Depends on:* The `app.config` object and a Python class or module.
- *Connects to:* Called in the application factory pattern to initialize settings based on the environment.
- *Shape:* A configuration loading boundary between Python objects and the internal dictionary.

## Concept Unit: os.environ — the process environment

### The Problem
When deploying an application, it must behave differently depending on where it runs (development, staging, production) without changing the code itself. How do you pass configuration settings, such as debug mode or database URLs, into a Python process from the outside? What would happen if we hardcoded a database URL in the code, and then deployed to a production server that uses a different database?

### Introduce the concept in isolation
We will use the `os` module to access `os.environ`, which provides a mapping of environment variables passed to the Python process by the operating system.

```python
import os

# os.environ: dict-like mapping of environment variables
# Set before starting Python: export DATABASE_URL=sqlite:///app.db
print('PATH:', os.environ.get('PATH', 'not set')[:30], '...')
print('HOME:', os.environ.get('HOME', 'not set'))

# get() with default: safe, no KeyError
debug_mode = os.environ.get('DEBUG', 'false').lower() == 'true'
print('DEBUG:', debug_mode)

# Required vars: fail loudly at startup if missing
def require_env(key):
    value = os.environ.get(key)
    if value is None:
        raise RuntimeError(f'Required environment variable {key!r} is not set.')
    return value

print('os.environ[key]: raises KeyError if missing')
print('os.environ.get(key): returns None if missing')
print('os.environ.get(key, default): returns default if missing')
```
Running this code outputs:
```text
PATH: C:\Windows\system32;C:\Windows ...
HOME: not set
DEBUG: False
os.environ[key]: raises KeyError if missing
os.environ.get(key): returns None if missing
os.environ.get(key, default): returns default if missing
```
This output proves that `os.environ` is populated by the operating system when the process starts. By using `os.environ.get('DEBUG', 'false')`, the code defaults to a string `'false'` if the variable is missing, safely evaluating to `False`. The `require_env` function demonstrates how to fail fast at startup if a critical variable is missing.

### Discard the throwaway
This code is deleted and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are establishing the baseline environment access pattern for our Flask application.
- **Files affected:** `app.py` (created)
- **Change type:** Add
- **Location:** At the top of the file
- **Dependencies:** Built-in `os` module

### The New Code
```python
import os

debug_mode = os.environ.get('DEBUG', 'false').lower() == 'true'
```

### The Updated Project
```python
# 1: import os
# 2: 
# 3: debug_mode = os.environ.get('DEBUG', 'false').lower() == 'true'  # ← new
```
This establishes that the application can read the `DEBUG` environment variable safely upon startup.

### Mechanical walkthrough
- `import os` makes the standard `os` module available, which contains operating system interfaces. `import` is a Python keyword used to bring a module into the current namespace.
- `os.environ` accesses the mapping object representing the string environment. It provides a dictionary-like interface to environment variables.
- `.get('DEBUG', 'false')` calls the `get` method on the `os.environ` mapping. It attempts to retrieve the value associated with the key `'DEBUG'`. If the key is not found, it returns the provided default value, which is the string `'false'`.
- `.lower()` calls the string method `lower` on the returned string, converting it to lowercase. This normalizes the input so that `'True'`, `'TRUE'`, or `'true'` are all treated consistently.
- `== 'true'` checks for equality against the lowercase string literal `'true'`. This boolean evaluation returns `True` if the environment variable is set to true, and `False` otherwise.
- `debug_mode =` assigns the resulting boolean value to the variable `debug_mode`.

### CS lens
Environment variables represent state passed across a process boundary. The operating system maintains the environment for a process when it launches. By reading `os.environ`, the application avoids tight coupling to its execution context. Because environment variables are strictly strings, the application is responsible for deserializing them into meaningful types (such as boolean parsing). 

### SE lens
Configuration via environment variables satisfies the 12-Factor App methodology (factor III: "Store config in the environment"). It ensures that the application is agnostic to its deployment environment and prevents secrets or local settings from being committed to version control. Failing loudly when required configuration is missing (fail fast) is a critical defensive programming practice, preventing the application from starting in an undefined state.

### Commands needed
pip install python-dotenv
Run: python app.py

### Run it
Execute the script to verify that `debug_mode` defaults to `False` without errors.
```bash
python app.py
```

### One sentence connecting to previous unit
While `os.environ` allows us to read configuration from the system, setting these variables manually every time we develop locally is tedious, which is why we introduce a file-based workflow for local development.

## Concept Unit: .env file and python-dotenv

### The Problem
During local development, setting numerous environment variables via the shell before running the application is error-prone and tedious. However, we cannot store these variables directly in the codebase because that would compromise security and violate the environment-driven config principle. How do we provide environment variables to our local process conveniently without committing them to source control?

### Introduce the concept in isolation
We use a `.env` file containing key-value pairs, and the `python-dotenv` package to load them into `os.environ`.

```python
# .env file (never commit to git!):
# SECRET_KEY=change-me-in-production-use-secrets-token-hex-32
# DATABASE_URL=sqlite:///app.db
# DEBUG=false
# FERNET_KEY=your-fernet-key-here

from dotenv import load_dotenv
import os

# load_dotenv(): reads .env, sets missing vars in os.environ
# Does NOT overwrite already-set vars (production env vars take precedence)
load_dotenv()  # looks for .env in current directory or parents

print('SECRET_KEY set:', 'SECRET_KEY' in os.environ)
print('DATABASE_URL:', os.environ.get('DATABASE_URL', 'not set'))

print('.env: local dev secrets. Never commit.')
print('.env.example: template with placeholder values. Commit this.')
print('Production: set vars via host dashboard (Heroku, fly.io, etc.)')
```
Running this code outputs:
```text
SECRET_KEY set: True
DATABASE_URL: sqlite:///app.db
.env: local dev secrets. Never commit.
.env.example: template with placeholder values. Commit this.
Production: set vars via host dashboard (Heroku, fly.io, etc.)
```
This output proves that `load_dotenv()` finds the `.env` file in the current working directory, parses its contents, and sets them in `os.environ`. If `SECRET_KEY` was already present in `os.environ` (as it would be in production), `load_dotenv` does not overwrite it, ensuring that production variables take precedence.

### Discard the throwaway
This code is deleted and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are configuring our local development setup.
- **Files affected:** `app.py` (modified)
- **Change type:** Add
- **Location:** Below the `os` import
- **Dependencies:** The `python-dotenv` package.

### The New Code
```python
from dotenv import load_dotenv

load_dotenv()
```

### The Updated Project
```python
# 1: import os
# 2: from dotenv import load_dotenv  # ← new
# 3: 
# 4: load_dotenv()  # ← new
# 5: 
# 6: debug_mode = os.environ.get('DEBUG', 'false').lower() == 'true'
```
This updates the application to automatically load environment variables from a `.env` file if one exists.

### Mechanical walkthrough
- `from dotenv import load_dotenv` imports the `load_dotenv` function from the `dotenv` module. `from ... import ...` is Python syntax to import a specific name from a module directly into the current namespace.
- `load_dotenv()` invokes the function without arguments. It searches for a `.env` file starting in the current directory and walking up the directory tree.
- When `load_dotenv` executes, it reads the file and updates the mapping object `os.environ`. By default, its `override` parameter is `False`, meaning it will not overwrite keys that are already present in `os.environ`.

### CS lens
The `.env` file acts as an implicit, localized storage mechanism that transparently maps to process memory (`os.environ`). This bridges the gap between file-system configuration and process-level configuration. By refusing to override existing environment variables, `load_dotenv` honors the hierarchy of configuration sources: system-level environment variables take precedence over file-level configurations.

### SE lens
The `.env` pattern solves the local configuration problem without violating the 12-Factor App rules, provided the `.env` file is heavily guarded (added to `.gitignore` so it is never committed). An `.env.example` file is often committed instead, containing safe placeholder values so that new developers know the required configuration shape without seeing real secrets.

### Commands needed
pip install python-dotenv
Run: python app.py

### Run it
Execute the script to verify that `load_dotenv` executes without error, loading variables if a `.env` file is present.
```bash
python app.py
```

### One sentence connecting to previous unit
Now that variables are loaded into the process environment reliably during both local development and production, we can inject them into the Flask application's configuration.

## Concept Unit: Flask config from environment

### The Problem
We have environment variables available in `os.environ`, but Flask components and extensions need a structured way to read configuration during the application lifecycle. How do we pass the environment variables into the Flask application instance so they are accessible globally through a unified configuration object? 

### Introduce the concept in isolation
We create a Flask application instance and use its `config.update` method to bulk-load settings derived from `os.environ`.

```python
import os
from dotenv import load_dotenv
from flask import Flask

load_dotenv()
app = Flask(__name__)

# Load all config from environment:
app.config.update(
    SECRET_KEY=os.environ.get('SECRET_KEY', 'dev-insecure-change-this'),
    DATABASE_URL=os.environ.get('DATABASE_URL', 'sqlite:///app.db'),
    DEBUG=os.environ.get('DEBUG', 'false').lower() == 'true',
    MAX_CONTENT_LENGTH=int(os.environ.get('MAX_UPLOAD_MB', '16')) * 1024 * 1024,
)

if app.config['SECRET_KEY'] == 'dev-insecure-change-this':
    import warnings
    warnings.warn('SECRET_KEY is insecure default. Set SECRET_KEY in .env', stacklevel=2)

print('Config loaded:')
print('  SECRET_KEY:', app.config['SECRET_KEY'][:8], '...')
print('  DATABASE_URL:', app.config['DATABASE_URL'])
print('  DEBUG:', app.config['DEBUG'])
print('  MAX_CONTENT_LENGTH:', app.config['MAX_CONTENT_LENGTH'] // 1024 // 1024, 'MB')
```
Running this code outputs:
```text
Config loaded:
  SECRET_KEY: dev-inse ...
  DATABASE_URL: sqlite:///app.db
  DEBUG: False
  MAX_CONTENT_LENGTH: 16 MB
```
This output proves that `app.config.update()` successfully applies multiple settings into the Flask application's central configuration registry. It demonstrates that when a secure key is missing, a fallback is used and a warning is raised, ensuring developers are alerted while allowing local execution to proceed.

### Discard the throwaway
This code is deleted and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition.
- **Files affected:** `app.py` (modified)
- **Change type:** Add
- **Location:** Below `load_dotenv()`
- **Dependencies:** The `Flask` class from the `flask` module.

### The New Code
```python
from flask import Flask

app = Flask(__name__)
app.config.update(
    SECRET_KEY=os.environ.get('SECRET_KEY', 'dev-insecure-change-this'),
    DEBUG=os.environ.get('DEBUG', 'false').lower() == 'true'
)
```

### The Updated Project
```python
# 1: import os
# 2: from dotenv import load_dotenv
# 3: from flask import Flask  # ← new
# 4: 
# 5: load_dotenv()
# 6: 
# 7: app = Flask(__name__)  # ← new
# 8: app.config.update(  # ← new
# 9:     SECRET_KEY=os.environ.get('SECRET_KEY', 'dev-insecure-change-this'),  # ← new
# 10:     DEBUG=os.environ.get('DEBUG', 'false').lower() == 'true'  # ← new
# 11: )  # ← new
```
This creates the Flask app and maps our environment variables directly into its configuration object.

### Mechanical walkthrough
- `from flask import Flask` imports the `Flask` class, the core application object.
- `app = Flask(__name__)` instantiates the application object, using `__name__` to help Flask locate resources.
- `app.config` accesses the configuration dictionary attribute of the `app` instance.
- `.update(...)` calls the dictionary update method to mutate the configuration in-place.
- `SECRET_KEY=os.environ.get('SECRET_KEY', 'dev-insecure-change-this')` passes a keyword argument. If `'SECRET_KEY'` is not in `os.environ`, it defaults to the string `'dev-insecure-change-this'`.
- `DEBUG=os.environ.get('DEBUG', 'false').lower() == 'true'` passes another keyword argument, converting the string representation of boolean state into a real Python `True` or `False`.

### CS lens
Configuration involves projecting untyped system boundaries (environment strings) into strongly typed application state (booleans, integers). The Flask `app.config` acts as a central registry—a single source of truth for the application's runtime parameters. Grouping these assignments through `update()` reduces multiple dictionary mutations into a single operation.

### SE lens
Providing fallback values (like `'dev-insecure-change-this'`) allows the application to boot effortlessly in a local development context without requiring an exhaustive `.env` file from day one. However, in production, these fallbacks must be overridden by secure, externally injected environment variables.

### Commands needed
pip install python-dotenv
Run: python app.py

### Run it
Execute the script to verify that the app initializes its config correctly.
```bash
python app.py
```

### One sentence connecting to previous unit
The application now requires a `SECRET_KEY` for operations like session signing, but using an insecure default is dangerous; we need a secure way to generate a real one.

## Concept Unit: Generating and managing SECRET_KEY

### The Problem
Flask requires a `SECRET_KEY` to cryptographically sign session cookies and securely manage flash messages, ensuring that clients cannot tamper with their session data. If this key is weak, attackers can forge sessions. If this key changes every time the application restarts, all active users will immediately be logged out. How do we create a secure, stable key?

### Introduce the concept in isolation
We will use Python's built-in `secrets` module to generate a cryptographically secure random token, demonstrating why it must be persisted.

```python
import secrets, os

# Flask SECRET_KEY: used to sign session cookies and flash messages
# Requirements: long (32+ bytes), random, stable (changing invalidates all sessions)

# Generate once:
secret = secrets.token_hex(32)  # 64 hex chars = 256 bits
print('Generated SECRET_KEY:', secret)
print('Length:', len(secret), 'chars')

print('WRONG (restarts invalidate sessions):')
print('  app.config["SECRET_KEY"] = secrets.token_hex(32)')

print('CORRECT (stable across restarts):')
print('  SECRET_KEY=<value> in .env or environment')

# Validate at startup:
with __import__('flask').Flask(__name__).app_context():
    key = os.environ.get('SECRET_KEY', '')
    if len(key) < 32:
        print('WARNING: SECRET_KEY is too short or missing!')
    else:
        print('SECRET_KEY OK: length', len(key))
```
Running this code outputs:
```text
Generated SECRET_KEY: a1b2c3d4...
Length: 64 chars
WRONG (restarts invalidate sessions):
  app.config["SECRET_KEY"] = secrets.token_hex(32)
CORRECT (stable across restarts):
  SECRET_KEY=<value> in .env or environment
WARNING: SECRET_KEY is too short or missing!
```
This output proves that `secrets.token_hex(32)` produces a secure 64-character hexadecimal string, providing 256 bits of entropy. The code explicitly highlights that generating the key dynamically inside the code invalidates sessions upon every application restart. The validation logic warns when an inadequate key is present.

### Discard the throwaway
This code is deleted and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch concept demonstration for generating secrets.
- **Files affected:** None directly modified (developer action)
- **Change type:** Configuration
- **Location:** `.env`
- **Dependencies:** The `secrets` module.

### The New Code
```python
# Execute in your Python REPL:
import secrets
print(secrets.token_hex(32))
# Copy the output and add to .env
```

### The Updated Project
No Python file modified. The `.env` file should now contain:
```text
SECRET_KEY=your_generated_hex_string_here
```
This action ensures a strong, persistent cryptographic secret is provided to the process environment via `.env`, which the application will then ingest.

### Mechanical walkthrough
- `import secrets` makes the standard `secrets` module available, which is designed for generating cryptographically strong random numbers suitable for managing data such as passwords and security tokens.
- `secrets.token_hex(32)` calls the `token_hex` function with `nbytes=32`. This generates a random string containing 32 random bytes, converted into a 64-character hexadecimal representation.
- The output string is a literal value that the developer manually pastes into the `.env` file assigned to `SECRET_KEY`.

### CS lens
Session management over stateless HTTP relies on cryptographically signing the session payload. If the signing key lacks entropy, attackers can perform brute-force attacks to derive the key and forge signatures. Providing 256 bits of entropy guarantees that the key space is practically impossible to exhaust.

### SE lens
Secret stability is an operational requirement. Generating a random key at process startup is a common anti-pattern that leads to intermittent logouts during deployments or worker process restarts. The key must be generated completely outside the application lifecycle, treated as static infrastructure configuration, and provided strictly via the environment.

### Commands needed
pip install python-dotenv
Run: python app.py

### Run it
Run the script to verify generation output.
```bash
python app.py
```

### One sentence connecting to previous unit
Injecting everything via `update()` directly in the global scope works for simple scripts, but as applications grow, we need to organize configurations cleanly based on the deployment target (development vs. production vs. testing).

## Concept Unit: Environment-based configuration classes

### The Problem
As our application configuration becomes more complex, maintaining a single monolithic dictionary block via `app.config.update` is difficult to manage. Production environments require stringent rules (like failing if `SECRET_KEY` is missing), while development or testing environments can safely use fallbacks or in-memory databases. How do we cleanly segregate configuration rules based on the environment context?

### Introduce the concept in isolation
We will use standard Python classes to encapsulate configuration, and Flask's `config.from_object` method to load the appropriate class based on the environment.

```python
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-default')
    DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///app.db')
    DEBUG = False
    TESTING = False

class DevelopmentConfig(Config):
    DEBUG = True
    DATABASE_URL = os.environ.get('DEV_DATABASE_URL', 'sqlite:///dev.db')

class TestingConfig(Config):
    TESTING = True
    DATABASE_URL = ':memory:'  # SQLite in-memory for tests
    WTF_CSRF_ENABLED = False

class ProductionConfig(Config):
    DEBUG = False
    # In production: all vars must come from real environment
    SECRET_KEY = os.environ['SECRET_KEY']  # KeyError if not set -> fail at startup
    DATABASE_URL = os.environ['DATABASE_URL']

CONFIG_MAP = {'development': DevelopmentConfig, 'testing': TestingConfig, 'production': ProductionConfig}

def create_app(env=None):
    from flask import Flask
    app = Flask(__name__)
    env = env or os.environ.get('FLASK_ENV', 'development')
    app.config.from_object(CONFIG_MAP.get(env, DevelopmentConfig))
    print(f'App created in {env} mode. DEBUG={app.config["DEBUG"]}')
    return app

create_app('development')
create_app('testing')
```
Running this code outputs:
```text
App created in development mode. DEBUG=True
App created in testing mode. DEBUG=False
```
This output proves that when `create_app('testing')` is called, the application dynamically resolves the environment string `'testing'` to the `TestingConfig` class via `CONFIG_MAP`. `app.config.from_object` reads the class attributes, setting `DATABASE_URL` to `':memory:'` and applying the specialized testing overrides safely. Furthermore, `ProductionConfig` relies strictly on `os.environ[key]`, ensuring that if secrets are missing, it raises a `KeyError` immediately.

### Discard the throwaway
This code is deleted and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition restructuring the application initialization.
- **Files affected:** `app.py` (modified)
- **Change type:** Refactor
- **Location:** Replacing the previous `app = Flask(__name__)` block
- **Dependencies:** None

### The New Code
```python
class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-insecure-change-this')
    DEBUG = False

class DevelopmentConfig(Config):
    DEBUG = True

CONFIG_MAP = {'development': DevelopmentConfig}

def create_app(env='development'):
    app = Flask(__name__)
    app.config.from_object(CONFIG_MAP.get(env, DevelopmentConfig))
    return app

app = create_app()
```

### The Updated Project
```python
# 1: import os
# 2: from dotenv import load_dotenv
# 3: from flask import Flask
# 4: 
# 5: load_dotenv()
# 6: 
# 7: class Config:  # ← new
# 8:     SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-insecure-change-this')  # ← new
# 9:     DEBUG = False  # ← new
# 10: 
# 11: class DevelopmentConfig(Config):  # ← new
# 12:     DEBUG = True  # ← new
# 13: 
# 14: CONFIG_MAP = {'development': DevelopmentConfig}  # ← new
# 15: 
# 16: def create_app(env='development'):  # ← new
# 17:     app = Flask(__name__)  # ← new
# 18:     app.config.from_object(CONFIG_MAP.get(env, DevelopmentConfig))  # ← new
# 19:     return app  # ← new
# 20: 
# 21: app = create_app()  # ← new
```
This restructures the app instantiation into an Application Factory pattern, mapping environment strings to distinct configuration classes.

### Mechanical walkthrough
- `class Config:` defines a base Python class. `class` is the keyword used to define classes.
- `SECRET_KEY =` assigns a class-level attribute.
- `class DevelopmentConfig(Config):` defines a subclass inheriting from `Config`. It overrides the `DEBUG` attribute to `True`.
- `CONFIG_MAP = {'development': DevelopmentConfig}` defines a dictionary mapping a string literal environment name to the corresponding class object.
- `def create_app(env='development'):` defines a function known as an application factory, accepting an environment string with a default value.
- `app.config.from_object(...)` calls the `from_object` method on the Flask configuration dictionary. It inspects the provided class and copies any uppercase attributes into the configuration dictionary.
- `CONFIG_MAP.get(env, DevelopmentConfig)` calls the dictionary `get` method, returning the matching configuration class for the string `env`, or defaulting to `DevelopmentConfig` if the key is not found.
- `return app` yields the fully configured WSGI application object back to the caller.
- `app = create_app()` executes the factory function, assigning the resulting configured instance to the global variable `app`.

### CS lens
Using classes for configuration leverages object-oriented inheritance to solve the problem of repetitive configuration. A base class provides a complete baseline contract for all environments, while subclasses surgically override behavior. The dictionary mapping acts as a simple routing table mapping string tokens (environment identifiers) to runtime types (configuration classes).

### SE lens
The Application Factory pattern (`create_app`) is a foundational Flask engineering practice. Instantiating the app via a function rather than directly in the global scope allows the application to be tested robustly, as the test suite can invoke `create_app('testing')` to spin up isolated application instances backed by an in-memory database without side effects on other tests.

### Commands needed
pip install python-dotenv
Run: python app.py

### Run it
Run the refactored script.
```bash
python app.py
```

### One sentence connecting to previous unit
By encapsulating the setup logic in a factory function powered by an environment map, the codebase is fully prepared for safe, 12-Factor compliant deployments.

## Closing

### Connect the pieces
Trace the application startup in a production environment: when the application boots, `load_dotenv()` runs but is a no-op because the hosting provider (e.g., Heroku or Docker) has already injected the environment variables into the OS boundary. `create_app('production')` is invoked, and `ProductionConfig` retrieves `os.environ['SECRET_KEY']`. Because `ProductionConfig` uses bracket notation, if the operations team forgot to set the `SECRET_KEY`, the application fails fast with a `KeyError`, preventing a startup with an insecure default. Once loaded into `app.config['SECRET_KEY']`, Flask uses this entropy to cryptographically sign session cookies, guaranteeing that session data remains safe in transit through all usage patterns taught in this curriculum.
