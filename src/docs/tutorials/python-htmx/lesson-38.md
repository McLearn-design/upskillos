# Lesson 38: Capstone — Deployment: Gunicorn, Environment Variables, and Production Checklist

**What you will build**
You will configure a production-ready WSGI server (Gunicorn) to serve the Flask application, replacing the built-in development server. You will also create a startup check that ensures all required environment variables are set before the application boots, and learn the deployment commands and production checklist required to safely launch the application on a real server. The core transferable problem is learning how to safely move a web application from a local development environment to a robust, concurrent, and secure production environment.

**What you need to know first**
- Lesson 37 (assuming previous lesson was on finalized app structure or similar).
- Python application structure and Flask's application factory pattern.

**Terms used in this lesson**
- **WSGI (Web Server Gateway Interface)** — A standard interface between web servers and Python web applications. It exists so that any Python web framework can run on any WSGI-compatible server without needing framework-specific code.
- **Worker Process** — An independent operating system process spawned by a master process to handle incoming requests. It exists to enable concurrency (handling multiple requests simultaneously) and to isolate failures, so a crash in one request doesn't take down the whole application.
- **Concurrency** — The ability to handle multiple things at once. In the context of a web server, it means serving multiple user requests at the exact same time without them having to wait in a single queue.
- **Environment Variable** — A dynamic value set at the operating system level, outside the application code. It exists to configure application behavior and store secrets (like database URLs or secret keys) securely across different environments (development vs production) without hardcoding them in version control.
- **Fail-fast** — A design principle where a system immediately aborts an operation upon detecting an error or missing requirement. It exists to prevent the system from running in an invalid or unpredictable state, which could lead to obscure errors or security vulnerabilities later on.

**Objects and methods used**

- **`gunicorn`**
  - *What it is:* The Green Unicorn WSGI HTTP Server command-line tool.
  - *Implementation:* `gunicorn [OPTIONS] [APP_MODULE]`
  - *Its use:* To run the Flask application in production with multiple worker processes and crash recovery.
  - *Type:* CLI Command / Executable.
  - *Responsibility:* Manages a master process that forks and monitors multiple worker processes to handle incoming HTTP requests efficiently and concurrently.
  - *Depends on:* A WSGI-compatible Python application (like Flask) and an execution environment.
  - *Connects to:* Listens on a network port, receives HTTP requests, and routes them to idle worker processes which call the Flask application.
  - *Shape:* An external server wrapper that sits between the public internet (or reverse proxy like Nginx) and the Python application code.

- **`multiprocessing.cpu_count()`**
  - *What it is:* A function in the Python standard library's `multiprocessing` module.
  - *Implementation:* `def cpu_count() -> int:`
  - *Its use:* To determine the number of logical CPU cores available on the host machine to dynamically configure the optimal number of Gunicorn workers.
  - *Type:* Python standard library function.
  - *Responsibility:* Returns the number of logical CPUs in the system.
  - *Depends on:* The host operating system's hardware reporting.
  - *Connects to:* Called by the configuration script to calculate the worker count formula.
  - *Shape:* A hardware introspection utility used during configuration.

- **`os.environ.get()`**
  - *What it is:* A method to safely retrieve the value of an environment variable.
  - *Implementation:* `os.environ.get(key, default=None)`
  - *Its use:* To check if required environment variables (like `SECRET_KEY`) are present during application startup.
  - *Type:* Python standard library dictionary method (on `os._Environ`).
  - *Responsibility:* Looks up an environment variable by name and returns its value, or a default (usually `None`) if it is not set.
  - *Depends on:* The operating system's environment variables.
  - *Connects to:* Accessed by the application code at startup to read configuration.
  - *Shape:* A boundary interface between the application runtime and the host operating system.

- **`secrets.token_hex()`**
  - *What it is:* A function to generate a secure random text string in hexadecimal format.
  - *Implementation:* `secrets.token_hex(nbytes=None) -> str`
  - *Its use:* To generate a cryptographically strong secret key for Flask session signing.
  - *Type:* Python standard library function.
  - *Responsibility:* Uses the operating system's cryptographic random number generator to produce a secure, unpredictable string.
  - *Depends on:* The host operating system's secure random source (e.g., `/dev/urandom`).
  - *Connects to:* Called by the developer or deployment script to produce a value that is then stored in the `SECRET_KEY` environment variable.
  - *Shape:* A cryptographic utility for generating secrets.

- **`subprocess.run()`**
  - *What it is:* A function to run a system command from Python.
  - *Implementation:* `subprocess.run(args, *, stdin=None, input=None, stdout=None, stderr=None, capture_output=False, shell=False, cwd=None, timeout=None, check=False, encoding=None, errors=None, text=None, env=None, universal_newlines=None, **other_popen_kwargs)`
  - *Its use:* Used in the deployment script example to execute shell commands like `git pull` or `systemctl restart`.
  - *Type:* Python standard library function.
  - *Responsibility:* Spawns a new process, connects to its input/output/error pipes, and waits for it to complete.
  - *Depends on:* The underlying operating system and the availability of the command being called.
  - *Connects to:* The shell or operating system process execution layer.
  - *Shape:* A bridge for executing external commands from within Python.

---

## Concept Unit: Why Flask's dev server is not for production

### The Problem
When you run a Flask application using `python app.py` or `flask run`, it uses a built-in development server provided by Werkzeug. What happens if two users try to access a slow page at the exact same time using the development server? What happens if an unexpected bug causes the server process to crash entirely? The built-in server is single-threaded by default and lacks process management, meaning requests will queue up sequentially and a single crash will take the whole application offline until you manually restart it.

### Introduce the concept in isolation

```python
import time
import urllib.request
import threading
from flask import Flask

app = Flask(__name__)

@app.route('/')
def slow_route():
    time.sleep(2) # Simulate a slow database query
    return '<h1>Finished</h1>'

# If you run this with the Flask dev server and send 3 requests simultaneously:
# Request 1 takes 2 seconds.
# Request 2 waits for Request 1 to finish, then takes 2 seconds (Total wait: 4s).
# Request 3 waits for Request 1 and 2, then takes 2 seconds (Total wait: 6s).

print("Dev: python app.py (DO NOT use in production)")
print("Prod: gunicorn app:app -w 4 -b 0.0.0.0:8000")
print("gunicorn app:app: module=app, callable=app (the Flask instance)")
```

Output:
```text
Dev: python app.py (DO NOT use in production)
Prod: gunicorn app:app -w 4 -b 0.0.0.0:8000
gunicorn app:app: module=app, callable=app (the Flask instance)
```

This output proves that the command `gunicorn app:app -w 4 -b 0.0.0.0:8000` is the intended replacement for the development server. By using **Gunicorn**, the master process creates 4 independent worker processes. When those 3 requests come in simultaneously, Request 1 goes to worker 1, Request 2 goes to worker 2, and Request 3 goes to worker 3. All three finish in exactly 2 seconds because they are handled concurrently.

### Discard the throwaway
This conceptual demonstration of the dev server's limitations is discarded and will not be used in our project code.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are configuring deployment infrastructure.
- **Files affected:** `requirements.txt` (modified)
- **Change type:** Add
- **Location:** At the bottom of the file.
- **Dependencies:** None.

### The New Code
```text
gunicorn==21.2.0
```

### The Updated Project
```text
1: Flask==3.0.0
2: // ... other dependencies ...
3: gunicorn==21.2.0 // ← new
```
This adds `gunicorn` to our project dependencies so it is installed when we run `pip install -r requirements.txt` on the production server.

### Mechanical walkthrough
- **`gunicorn==21.2.0`**: This line declares a strict dependency on the Gunicorn package at exactly version 21.2.0. This ensures that the production environment uses the exact same version we expect, preventing unexpected behavior from future updates.

### CS lens
Concurrency in web servers is achieved through either threading (multiple threads in one process), multiprocessing (multiple distinct processes), or asynchronous I/O (an event loop). Gunicorn uses a pre-fork worker model (multiprocessing). The master process starts, binds to the network port, and then forks itself into multiple worker processes. This means each worker gets its own isolated Python interpreter and memory space, completely bypassing Python's Global Interpreter Lock (GIL) limitations and allowing true parallel execution on multi-core CPUs.

### SE lens
Relying on the development server in production is a severe operational risk. It exposes interactive debuggers (which allow arbitrary remote code execution if `DEBUG=True`), lacks connection timeouts (allowing attackers to hold connections open and exhaust resources), and has no mechanism to recover from a crash. Gunicorn is a specialized tool that does exactly one thing well: process management and HTTP serving.

### Commands needed
```bash
pip install gunicorn
```

### Run it
Run the command to install the package in your virtual environment.

### One sentence connecting to previous unit
Now that Gunicorn is installed, we need to instruct it on how exactly to run our application efficiently across multiple CPU cores.

---

## Concept Unit: Gunicorn configuration file

### The Problem
Gunicorn can be configured entirely via command-line arguments (`gunicorn -w 4 -b 0.0.0.0:8000 app:app`), but typing complex arguments every time is error-prone. How do we ensure that Gunicorn always starts with the correct number of workers based on the server's hardware, logs output correctly, and reaps stalled requests?

### Introduce the concept in isolation

```python
import multiprocessing

# The standard formula for Gunicorn workers is (2 x CPU cores) + 1.
cpu_cores = multiprocessing.cpu_count()
workers = (cpu_cores * 2) + 1

print(f"Detected {cpu_cores} cores. Spawning {workers} workers.")
```

Output (on a 4-core machine):
```text
Detected 4 cores. Spawning 9 workers.
```

This proves that `multiprocessing.cpu_count()` allows us to dynamically calculate the optimal number of worker processes. The formula `(2 * CPU cores) + 1` is an industry-standard rule of thumb for I/O-bound web applications: it assumes that while one worker is blocked waiting for a database response, another worker can handle a new request.

### Discard the throwaway
This standalone calculation script is discarded.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are configuring Gunicorn settings for production.
- **Files affected:** `gunicorn.conf.py` (created)
- **Change type:** Add
- **Location:** In the project root directory.
- **Dependencies:** Python's `multiprocessing` module.

### The New Code
```python
import multiprocessing

workers = multiprocessing.cpu_count() * 2 + 1
bind = '0.0.0.0:8000'
worker_class = 'sync'
timeout = 30
preload_app = True
```

### The Updated Project
```python
1: import multiprocessing // ← new
2: 
3: workers = multiprocessing.cpu_count() * 2 + 1 // ← new
4: bind = '0.0.0.0:8000' // ← new
5: worker_class = 'sync' // ← new
6: timeout = 30 // ← new
7: preload_app = True // ← new
```
This new file configures Gunicorn. Gunicorn will automatically look for `gunicorn.conf.py` in the current directory when it starts and use these settings.

### Mechanical walkthrough
- **`import multiprocessing`**: Imports the standard library module to inspect the host hardware.
- **`workers = multiprocessing.cpu_count() * 2 + 1`**: Calculates the number of worker processes to spawn based on available cores.
- **`bind = '0.0.0.0:8000'`**: Instructs Gunicorn to listen on port `8000` on all available network interfaces (`0.0.0.0`), not just localhost. This is required for external traffic (or a reverse proxy like Nginx) to reach the app.
- **`worker_class = 'sync'`**: Uses the default synchronous worker model, where each worker handles one request at a time sequentially.
- **`timeout = 30`**: If a request takes longer than 30 seconds to process, the master process will forcibly kill that worker and start a fresh one, preventing stalled requests from tying up the whole server.
- **`preload_app = True`**: Instructs the master process to load the application code into memory *before* forking the worker processes.

### CS lens
The `preload_app = True` directive takes advantage of modern operating system memory management called Copy-On-Write (COW). When the master process forks a worker, the worker process shares the exact same physical memory pages as the master. Only if a worker modifies memory is a new copy created. By loading the entire Flask app *before* forking, all workers share the same imported libraries and code in memory, saving significant RAM compared to each worker loading the app independently.

### SE lens
Infrastructure as Code (IaC) principles dictate that configuration should be version-controlled just like source code. By placing these settings in `gunicorn.conf.py` rather than relying on a complex shell command, we ensure that the deployment is reproducible and that anyone reviewing the repository can immediately see the production tuning parameters.

### Commands needed
None.

### Run it
No execution needed yet; this is a configuration file that Gunicorn will read later.

### One sentence connecting to previous unit
With the server capable of running robustly, we must now ensure it fails safely if the environment is missing critical secrets.

---

## Concept Unit: Production environment variables and .env

### The Problem
During development, we might hardcode settings or use a `.env` file loaded by a library. In production, hardcoding a database URL or a cryptographic `SECRET_KEY` is a massive security vulnerability. Furthermore, if the server boots up without a `SECRET_KEY` defined, it might silently fail or generate a random one, which would invalidate all active user sessions every time the server restarts. How do we ensure the application refuses to start if its environment is misconfigured?

### Introduce the concept in isolation

```python
import os

def check_env():
    secret = os.environ.get('SECRET_KEY')
    if not secret:
        raise RuntimeError("Missing required environment variable: SECRET_KEY")
    print("Environment is valid. Starting app...")

try:
    check_env()
except RuntimeError as e:
    print(f"Startup aborted: {e}")
```

Output:
```text
Startup aborted: Missing required environment variable: SECRET_KEY
```

This proves that `os.environ.get()` returns `None` if the variable is missing, allowing us to explicitly raise a `RuntimeError`. This is a **fail-fast** mechanism: it immediately crashes the application during the startup sequence rather than waiting for a request that actually requires the `SECRET_KEY` to blow up later.

### Discard the throwaway
This standalone check function is discarded.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py` (modified)
- **Change type:** Add
- **Location:** At the top of the file, immediately after imports and before the Flask app initialization.
- **Dependencies:** The `os` module.

### The New Code
```python
def check_required_env():
    required = ['SECRET_KEY', 'DATABASE_URL']
    missing = [key for key in required if not os.environ.get(key)]
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")

check_required_env()
```

### The Updated Project
```python
1: import os
2: from flask import Flask
3: 
4: def check_required_env(): // ← new
5:     required = ['SECRET_KEY', 'DATABASE_URL'] // ← new
6:     missing = [key for key in required if not os.environ.get(key)] // ← new
7:     if missing: // ← new
8:         raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}") // ← new
9:         
10: check_required_env() // ← new
11: 
12: app = Flask(__name__)
```
This adds a startup check that ensures the process aborts immediately if it was not launched with the required variables provided by the host.

### Mechanical walkthrough
- **`def check_required_env():`**: Defines a function to perform the environment validation.
- **`required = ['SECRET_KEY', 'DATABASE_URL']`**: A list of variable names that the application absolutely needs to function securely.
- **`missing = [key for key in required if not os.environ.get(key)]`**: A list comprehension that iterates over the required keys, checking `os.environ.get()`. If the result is falsy (missing or empty string), the key is added to the `missing` list.
- **`if missing:`**: Evaluates to True if the list contains any items.
- **`raise RuntimeError(...)`**: Throws an exception detailing exactly which variables were missing, which causes the Python process to exit with a non-zero status code.
- **`check_required_env()`**: Calls the function sequentially before the `app = Flask(__name__)` line is ever reached.

### CS lens
This is a manifestation of the **Fail-fast** design principle. A system should report at its interface any condition that is likely to cause a failure. Failing fast reduces debugging time because the error is reported immediately and precisely ("Missing SECRET_KEY"), rather than manifesting as a generic "500 Internal Server Error" during a cryptographic operation minutes or days later.

### SE lens
The Twelve-Factor App methodology states that an application should store its config in the environment. Configuration varies substantially across deploys (staging vs production), whereas code does not. By strictly enforcing that these values must come from the environment and refusing to boot without them, we prevent accidental deployments where a production server boots using a leftover development database.

### Commands needed
None.

### Run it
No execution needed here. The application will now refuse to start without these variables.

### One sentence connecting to previous unit
Before we write the script that actually launches the app, we need a definitive list of everything that must be verified on the server.

---

## Concept Unit: Production checklist

### The Problem
Deploying to production is not just running the code; it is ensuring that the configuration is secure and reliable. How do we ensure we haven't forgotten to disable debug mode or apply database schema migrations before launching?

### Introduce the concept in isolation

```python
import secrets

# Generating a strong SECRET_KEY for production
strong_key = secrets.token_hex(32)
print(f"Generated key length: {len(strong_key)}")
print(f"Sample: {strong_key[:10]}...")
```

Output:
```text
Generated key length: 64
Sample: e3b0c44298...
```

This output proves that `secrets.token_hex(32)` produces a 64-character hexadecimal string containing 32 bytes of secure entropy. This command is run exactly once on the production server to generate the value that is then saved into the `SECRET_KEY` environment variable.

### Discard the throwaway
This key generation script is discarded.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `checklist.md` (created)
- **Change type:** Add
- **Location:** Project root.
- **Dependencies:** None.

### The New Code
```markdown
# Production Checklist
- [ ] `DEBUG=False` in environment.
- [ ] Strong `SECRET_KEY` generated via `python3 -c "import secrets; print(secrets.token_hex(32))"`.
- [ ] HTTPS enabled (TLS certificate).
- [ ] Database initialized via `flask --app app init-db`.
- [ ] Dependencies locked via `pip freeze > requirements.txt`.
- [ ] `.env` and `.db` files added to `.gitignore`.
```

### The Updated Project
```markdown
1: # Production Checklist // ← new
2: - [ ] `DEBUG=False` in environment. // ← new
3: - [ ] Strong `SECRET_KEY` generated via `python3 -c "import secrets; print(secrets.token_hex(32))"`. // ← new
4: - [ ] HTTPS enabled (TLS certificate). // ← new
5: - [ ] Database initialized via `flask --app app init-db`. // ← new
6: - [ ] Dependencies locked via `pip freeze > requirements.txt`. // ← new
7: - [ ] `.env` and `.db` files added to `.gitignore`. // ← new
```
This file acts as a human-readable operational guide. It is not executed by Python, but is used by the developer during deployment.

### Mechanical walkthrough
- **`DEBUG=False` in environment**: Ensures the Werkzeug interactive debugger is disabled, preventing arbitrary code execution exploits.
- **Strong `SECRET_KEY`**: Ensures session cookies cannot be forged by an attacker.
- **HTTPS enabled**: Ensures data in transit (like passwords) cannot be intercepted.
- **Database initialized**: Ensures the necessary tables exist in the production database file.
- **Dependencies locked**: Ensures that the exact versions tested locally are installed in production.
- **`.env` and `.db` files added to `.gitignore`**: Ensures secrets and real user data are never accidentally pushed to the public code repository.

### CS lens
Security in a web application is defense in depth. A vulnerability in one layer (like a weak session key) can often be mitigated by security in another layer (like HTTPS encrypting the traffic). The checklist ensures all layers of defense are active before public exposure.

### SE lens
Checklists are a proven software engineering tool borrowed from aviation and medicine. They reduce complex, multi-step procedures into verified items, minimizing the chance of human error during high-stress operations like deploying a new application to production.

### Commands needed
None.

### Run it
No execution needed.

### One sentence connecting to previous unit
With the checklist complete, we can automate the actual execution of these steps using a deployment script.

---

## Concept Unit: Simple deployment script

### The Problem
Deploying an update requires pulling the latest code, installing new dependencies, applying database updates, and restarting the Gunicorn server. Doing this manually by typing commands on the server is slow and prone to typos. How can we codify the deployment steps?

### Introduce the concept in isolation

```python
# A simulation of what the deployment script does sequentially
print("1. git pull origin main")
print("2. pip install -r requirements.txt")
print("3. flask --app app init-db")
print("4. systemctl restart myapp")
```

Output:
```text
1. git pull origin main
2. pip install -r requirements.txt
3. flask --app app init-db
4. systemctl restart myapp
```

This output proves the required sequence of operations. The code must be fetched first, then its dependencies installed, then the database updated to match the new code, and finally, the server restarted so the master process kills the old workers and forks new ones running the newly downloaded code.

### Discard the throwaway
This simulation is discarded.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `deploy.sh` (created)
- **Change type:** Add
- **Location:** Project root.
- **Dependencies:** Bash shell, Git, Python virtual environment, systemd.

### The New Code
```bash
#!/bin/bash
set -e

echo "Deploying updates..."
git pull origin main
source venv/bin/activate
pip install -r requirements.txt
flask --app app init-db
sudo systemctl restart myapp
echo "Deployment complete."
```

### The Updated Project
```bash
1: #!/bin/bash // ← new
2: set -e // ← new
3: 
4: echo "Deploying updates..." // ← new
5: git pull origin main // ← new
6: source venv/bin/activate // ← new
7: pip install -r requirements.txt // ← new
8: flask --app app init-db // ← new
9: sudo systemctl restart myapp // ← new
10: echo "Deployment complete." // ← new
```
This creates a shell script that automates the rollout of new code to the production server.

### Mechanical walkthrough
- **`#!/bin/bash`**: The shebang line indicating this script should be run by the Bash shell.
- **`set -e`**: Instructs bash to exit immediately if any command in the script fails. This is crucial: if `git pull` fails due to a merge conflict, the script aborts immediately rather than blindly restarting the server.
- **`git pull origin main`**: Fetches the latest code from the repository.
- **`source venv/bin/activate`**: Activates the server's Python virtual environment.
- **`pip install -r requirements.txt`**: Installs or updates any dependencies added to the `requirements.txt` file.
- **`flask --app app init-db`**: Runs the database initialization script to ensure the schema is up to date.
- **`sudo systemctl restart myapp`**: Instructs the operating system's service manager (`systemd`) to stop and restart the Gunicorn process, which will load the new code.

### CS lens
The `systemctl restart` command relies on the operating system's process manager. When systemd restarts the service, it sends a `SIGTERM` signal to the Gunicorn master process. Gunicorn waits for active requests to finish (up to a timeout), shuts down the workers gracefully, exits, and is immediately launched again by systemd. This provides a zero-downtime or minimal-downtime reload mechanism.

### SE lens
Automation of deployment (even a simple shell script) is the first step toward Continuous Deployment (CD). It eliminates human error from the deployment process and serves as living documentation of exactly what is required to update the application in production.

### Commands needed
```bash
chmod +x deploy.sh
```

### Run it
Run the command to make the script executable on Unix-based systems.

### One sentence connecting to previous unit
The application is now fully configured and automated for a production environment.

---

## Closing

### Connect the pieces
The journey from a local script to a production-ready application requires multiple layers. The development server handles single requests for debugging, but in production, **Gunicorn** takes over to fork multiple workers for concurrency and crash recovery. Gunicorn relies on `gunicorn.conf.py` to tune its behavior dynamically based on CPU cores. The application itself was hardened to enforce a **fail-fast** check for environment variables, refusing to boot if `SECRET_KEY` is missing. Finally, we constructed a production checklist to verify manual security steps, and wrote a `deploy.sh` script to automate pulling code, installing dependencies, migrating the database, and restarting the server. Together, these pieces ensure that deploying updates is secure, reproducible, and robust.
