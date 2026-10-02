"""CodeLens Python tracer.

Runs a learner's program under sys.settrace and records, at every line it executes:
the call stack with each frame's variables, and the objects reachable from those
variables (lists, tuples, dicts, sets, deques and instances of the learner's own
classes) as heap events. The result has the same shape the JavaScript interpreter
produces (src/labs/codelens/codelens/types.ts ExecutionResult), so every CodeLens view
works for Python too.

The same file runs in two places:
  - the browser, inside Pyodide in a Web Worker (interpreter/pythonExecution.worker.ts);
  - the desktop app, on the learner's own CPython (interpreter/pythonExecutionClient.ts).

Values
  A variable or property holds a plain JSON value for None/bool/int/float/str, or
  {"$ref": n} for a tracked object, where n is a small id that stays the same for the
  object's whole life. Two variables pointing at the same list therefore show the same
  id, which is how the heap view draws shared references.

Heap events
  At each step the tracer walks the objects reachable from the learner's frames and
  diffs them against the previous step: a new object becomes "create", a changed
  property "mutate", a removed one "delete", and an object no longer reachable "free".

What each line does
  Every statement_enter event (a line about to run) carries `statement`: what kind of
  statement the line is, read from the program's syntax tree (an assignment, an `if`, a
  `for` loop, a `return`, a call...), with its code. What running the line actually did
  (its `outcome`) is worked out afterwards from the events that follow it, by
  src/labs/codelens/codelens/traceOutcomes.ts, shared with the C/C++ tracer; the
  explanation panel turns both into a sentence per line (explainTrace.ts).
"""

import ast
import collections
import io
import json
import sys
import time
import types

USER_FILE = '<codelens>'

DEFAULT_LIMITS = {
    'maxRuntimeMs': 5000,
    'maxSteps': 20000,
    'maxEvents': 20000,
    'maxOutputLines': 500,
    'maxOutputChars': 100000,
    'maxRecursionDepth': 200,
    'maxHeapObjects': 400,
    'maxSnapshotItems': 60,
    'maxSnapshotChars': 200,
}

_CONTAINERS = (list, tuple, dict, set, frozenset, collections.deque)
_NOT_DATA = (types.FunctionType, types.BuiltinFunctionType, types.MethodType,
             types.ModuleType, type, types.GeneratorType, types.CodeType, types.FrameType)


class _LimitReached(BaseException):
    """Stops the learner's program. BaseException so `except Exception:` can't swallow it."""

    def __init__(self, kind, message):
        super().__init__(message)
        self.kind = kind
        self.message = message


class _Output(io.TextIOBase):
    """Captures print() output, bounded by the output limits."""

    def __init__(self, tracer):
        self.tracer = tracer
        self.parts = []
        self.chars = 0
        self.line_count = 0

    def writable(self):
        return True

    def write(self, text):
        limits = self.tracer.limits
        self.chars += len(text)
        self.line_count += text.count('\n')
        if self.chars > limits['maxOutputChars']:
            raise _LimitReached('output', f"Output limit ({limits['maxOutputChars']:,} characters) reached")
        self.parts.append(text)
        if self.line_count > limits['maxOutputLines']:
            raise _LimitReached('output', f"Output limit ({limits['maxOutputLines']} lines) reached")
        return len(text)

    def lines(self):
        text = ''.join(self.parts)
        if text.endswith('\n'):
            text = text[:-1]
        return text.split('\n') if text else []


class Tracer:
    def __init__(self, limits):
        self.limits = {**DEFAULT_LIMITS, **(limits or {})}
        self.events = []
        self.ids = {}          # id(obj) -> stable small id
        self.alive = []        # keeps tracked objects alive so CPython can't reuse their id()
        self.previous = {}     # small id -> (type name, properties) at the last step
        self.started = time.monotonic()
        self.steps = 0
        self.depth = 0
        self.frame_values = {}  # id(frame) -> its variables at its previous event (for 'changes')
        self.statements = {}    # line -> what the statement starting on it is (statement_info)
        self.output = None      # the _Output capturing print(), for 'printed'
        self.printed_parts = 0  # how many output parts earlier events have already reported

    # ── values ──────────────────────────────────────────────────────────────

    def is_tracked(self, value):
        if isinstance(value, _CONTAINERS):
            return True
        if isinstance(value, _NOT_DATA):
            return False
        # Instances of the learner's own classes (defined in the program, so in __main__).
        return getattr(type(value), '__module__', None) == '__main__'

    def object_id(self, value):
        key = id(value)
        small = self.ids.get(key)
        if small is None:
            small = len(self.ids) + 1
            self.ids[key] = small
            self.alive.append(value)
        return small

    def value(self, value):
        if value is None or isinstance(value, bool):
            return value
        if isinstance(value, int):
            return value if abs(value) < 2 ** 53 else str(value)
        if isinstance(value, float):
            return value if value == value and value not in (float('inf'), float('-inf')) else str(value)
        if isinstance(value, str):
            limit = self.limits['maxSnapshotChars']
            return value if len(value) <= limit else value[:limit - 1] + '…'
        if self.is_tracked(value):
            return {'$ref': self.object_id(value)}
        if isinstance(value, (types.FunctionType, types.BuiltinFunctionType, types.MethodType)):
            return f'[Function: {getattr(value, "__name__", "?")}]'   # same form as the JavaScript interpreter
        if isinstance(value, type):
            return f'[Class: {value.__name__}]'
        if isinstance(value, types.ModuleType):
            return f'[Module: {value.__name__}]'
        text = repr(value)
        return text if len(text) <= 80 else text[:79] + '…'

    def type_name(self, obj):
        return type(obj).__name__

    def properties(self, obj):
        """The object's contents as {name: value}, bounded by maxSnapshotItems."""
        limit = self.limits['maxSnapshotItems']
        props = {}
        if isinstance(obj, (list, tuple, collections.deque)):
            for index, item in enumerate(obj):
                if index >= limit:
                    props['…'] = f'{len(obj) - limit} more'
                    break
                props[str(index)] = self.value(item)
        elif isinstance(obj, dict):
            for index, (key, item) in enumerate(obj.items()):
                if index >= limit:
                    props['…'] = f'{len(obj) - limit} more'
                    break
                props[key if isinstance(key, str) else repr(key)] = self.value(item)
        elif isinstance(obj, (set, frozenset)):
            # Sets have no order of their own; sort by repr so a set that hasn't changed
            # doesn't look changed between steps.
            for index, item in enumerate(sorted(obj, key=repr)):
                if index >= limit:
                    props['…'] = f'{len(obj) - limit} more'
                    break
                props[str(index)] = self.value(item)
        else:
            fields = dict(getattr(obj, '__dict__', {}))
            for slot in getattr(type(obj), '__slots__', ()):
                if hasattr(obj, slot):
                    fields[slot] = getattr(obj, slot)
            for index, (name, item) in enumerate(fields.items()):
                if name.startswith('__'):
                    continue
                if index >= limit:
                    props['…'] = f'{len(fields) - limit} more'
                    break
                props[name] = self.value(item)
        return props

    # ── frames ──────────────────────────────────────────────────────────────

    @staticmethod
    def is_user_frame(frame):
        return frame.f_code.co_filename == USER_FILE

    @staticmethod
    def frame_name(frame):
        name = frame.f_code.co_name
        return '(global)' if name == '<module>' else name

    @staticmethod
    def visible_locals(frame):
        """The learner's own variables: no dunders (__builtins__, __name__, ...) and, at
        module level, no imported modules."""
        at_module_level = frame.f_code.co_name == '<module>'
        return [(name, item) for name, item in frame.f_locals.items()
                if not name.startswith('__') and not (at_module_level and isinstance(item, types.ModuleType))]

    @staticmethod
    def is_class_body(frame):
        # Python runs a class statement's body as a frame of its own. Tracing it as a call
        # would read as if the class were being called. Every function (and lambda) is
        # compiled with the CO_OPTIMIZED flag; a class body never is, and neither is the
        # module, which is told apart by its name. (Checking for __qualname__ in the frame's
        # variables doesn't work: they aren't set yet when the 'call' event fires.)
        CO_OPTIMIZED = 0x1
        code = frame.f_code
        return code.co_name != '<module>' and not (code.co_flags & CO_OPTIMIZED)

    def frame_locals(self, frame):
        return {name: self.value(item) for name, item in self.visible_locals(frame)}

    def stack(self, frame):
        frames = []
        current = frame
        while current is not None:
            if self.is_user_frame(current) and not self.is_class_body(current):
                frames.append({'name': self.frame_name(current), 'line': current.f_lineno, 'locals': self.frame_locals(current)})
            current = current.f_back
        frames.reverse()   # outermost first, like the JavaScript interpreter
        return frames

    # ── heap diff ───────────────────────────────────────────────────────────

    def heap_delta(self, frame):
        """Walk every object reachable from the learner's frames; diff against last step."""
        roots = []
        current = frame
        while current is not None:
            if self.is_user_frame(current) and not self.is_class_body(current):
                roots.extend(item for _, item in self.visible_locals(current))
            current = current.f_back

        current_state = {}
        queue = [v for v in roots if self.is_tracked(v)]
        seen = set()
        while queue and len(current_state) < self.limits['maxHeapObjects']:
            obj = queue.pop(0)
            if id(obj) in seen:
                continue
            seen.add(id(obj))
            small = self.object_id(obj)
            props = self.properties(obj)
            current_state[small] = (self.type_name(obj), props)
            children = obj.values() if isinstance(obj, dict) else (obj if isinstance(obj, _CONTAINERS) else props_source(obj))
            for child in list(children)[: self.limits['maxSnapshotItems']]:
                if self.is_tracked(child) and id(child) not in seen:
                    queue.append(child)

        delta = []
        for small, (type_name, props) in current_state.items():
            before = self.previous.get(small)
            if before is None:
                delta.append({'op': 'create', 'objectId': small, 'objectType': type_name, 'properties': props})
                continue
            old_props = before[1]
            for name, new_value in props.items():
                if name not in old_props:
                    # A new property: no oldValue, which is different from an old value of None.
                    delta.append({'op': 'mutate', 'objectId': small, 'objectType': type_name, 'property': name, 'newValue': new_value})
                elif old_props[name] != new_value:
                    delta.append({'op': 'mutate', 'objectId': small, 'objectType': type_name, 'property': name,
                                  'oldValue': old_props[name], 'newValue': new_value})
            for name in old_props:
                if name not in props:
                    delta.append({'op': 'delete', 'objectId': small, 'objectType': type_name, 'property': name})
        for small in self.previous:
            if small not in current_state:
                delta.append({'op': 'free', 'objectId': small})
        self.previous = current_state
        return delta

    # ── events ──────────────────────────────────────────────────────────────

    def check_limits(self):
        limits = self.limits
        elapsed_ms = (time.monotonic() - self.started) * 1000
        if elapsed_ms > limits['maxRuntimeMs']:
            raise _LimitReached('timeout', f"Runtime limit ({limits['maxRuntimeMs']:,} ms) reached")
        if self.steps > limits['maxSteps']:
            raise _LimitReached('steps', f"Step limit ({limits['maxSteps']:,} lines executed) reached")
        if len(self.events) >= limits['maxEvents']:
            raise _LimitReached('events', f"Trace limit ({limits['maxEvents']:,} events) reached")

    def changes(self, frame, current_locals):
        """Variables of this frame that are new or changed since its previous event, as
        [{name, oldValue, newValue, isNew}], for the step-by-step explanation."""
        key = id(frame)
        before = self.frame_values.get(key)
        self.frame_values[key] = current_locals
        if before is None:
            return []
        out = []
        for name, value in current_locals.items():
            if name not in before:
                out.append({'name': name, 'newValue': value, 'isNew': True})
            elif before[name] != value:
                out.append({'name': name, 'oldValue': before[name], 'newValue': value, 'isNew': False})
        return out

    def emit(self, event_type, frame, **payload):
        line = frame.f_lineno
        stack = self.stack(frame)
        current_locals = stack[-1]['locals'] if stack else {}
        printed = ''
        if self.output is not None and len(self.output.parts) > self.printed_parts:
            printed = ''.join(self.output.parts[self.printed_parts:])
            self.printed_parts = len(self.output.parts)
        event = {
            'stepId': len(self.events),
            'type': event_type,
            'language': 'python',
            'line': line,
            'sourceLocation': {'line': line},
            'stackSnapshot': stack,
            'heapDelta': self.heap_delta(frame),
            'changes': self.changes(frame, current_locals),
            **payload,
        }
        if printed:
            event['printed'] = printed   # what print() wrote since the previous event
        if event_type == 'statement_enter' and line in self.statements:
            event['statement'] = self.statements[line]
        self.events.append(event)

    def trace(self, frame, event, arg):
        if not self.is_user_frame(frame) or (event == 'call' and self.is_class_body(frame)):
            return None   # library code: don't trace inside it (calls back into user code still are)
        if event == 'call':
            self.depth += 1
            if self.depth > self.limits['maxRecursionDepth']:
                raise _LimitReached('recursion', f"Recursion limit ({self.limits['maxRecursionDepth']} nested calls) reached")
            if frame.f_code.co_name != '<module>':
                args = [self.value(frame.f_locals.get(name)) for name in frame.f_code.co_varnames[: frame.f_code.co_argcount]]
                arg_names = list(frame.f_code.co_varnames[: frame.f_code.co_argcount])
                self.emit('function_call', frame, functionName=self.frame_name(frame), args=args, argNames=arg_names)
            return self.trace
        if event == 'line':
            self.steps += 1
            self.check_limits()
            self.emit('statement_enter', frame)
        elif event == 'return':
            self.depth -= 1
            if frame.f_code.co_name != '<module>':
                self.emit('function_return', frame, functionName=self.frame_name(frame), returnValue=self.value(arg))
            else:
                # A 'line' event fires before its line runs, so without this the effect of
                # the program's last line would never be shown.
                self.emit('program_end', frame)
            # Python reuses a finished frame's id() for later frames; forget this one so a
            # new call isn't compared with a dead call's variables.
            self.frame_values.pop(id(frame), None)
        return self.trace


def props_source(obj):
    """Values held by a learner-class instance, for walking the object graph."""
    values = list(getattr(obj, '__dict__', {}).values())
    for slot in getattr(type(obj), '__slots__', ()):
        if hasattr(obj, slot):
            values.append(getattr(obj, slot))
    return values


def _user_line(error):
    tb = error.__traceback__
    line = None
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == USER_FILE:
            line = tb.tb_lineno
        tb = tb.tb_next
    return line


def _line_span(nodes):
    """[first line, last line] covered by a list of statements, or None."""
    if not nodes:
        return None
    return [nodes[0].lineno, getattr(nodes[-1], 'end_lineno', nodes[-1].lineno)]


def _names(target):
    """Variable names a target assigns: `a`, `a, b`, `self.x` (as "self.x"), `items[0]`."""
    if isinstance(target, ast.Name):
        return [target.id]
    if isinstance(target, (ast.Tuple, ast.List)):
        return [name for element in target.elts for name in _names(element)]
    try:
        return [ast.unparse(target)]
    except Exception:
        return []


def _call_name(node):
    try:
        return ast.unparse(node.func)
    except Exception:
        return None


def statement_info(source):
    """line -> {kind, code, ...} for the statement that starts on each line.

    `code` is the line's own text (for an `if` or a loop, just its header). Compound
    statements add where their parts are, so the outcome can tell which way they went:
    `body` and `orelse` as [first line, last line]."""
    lines = source.split('\n')
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return {}
    info = {}
    for node in ast.walk(tree):
        if not isinstance(node, ast.stmt) or node.lineno in info:
            continue   # ast.walk visits outer statements first; keep the outermost per line
        text = lines[node.lineno - 1].strip() if node.lineno - 1 < len(lines) else ''
        entry = {'kind': type(node).__name__, 'code': text if len(text) <= 120 else text[:119] + '\u2026'}
        if isinstance(node, (ast.If, ast.While, ast.For, ast.AsyncFor)):
            entry['body'] = _line_span(node.body)
            if node.orelse:
                entry['orelse'] = _line_span(node.orelse)
            if isinstance(node, ast.If):
                entry['isElif'] = text.startswith('elif')
        if isinstance(node, (ast.For, ast.AsyncFor)):
            entry['targets'] = _names(node.target)
            try:
                entry['iterable'] = ast.unparse(node.iter)
            except Exception:
                pass
        if isinstance(node, (ast.If, ast.While)):
            try:
                entry['condition'] = ast.unparse(node.test)
            except Exception:
                pass
        if isinstance(node, ast.Assign):
            entry['targets'] = [name for target in node.targets for name in _names(target)]
        if isinstance(node, (ast.AugAssign, ast.AnnAssign)):
            entry['targets'] = _names(node.target)
        if isinstance(node, ast.AugAssign):
            entry['operator'] = type(node.op).__name__
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            entry['name'] = node.name
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Call):
            entry['call'] = _call_name(node.value)
        if isinstance(node, ast.Return) and node.value is not None:
            try:
                entry['expression'] = ast.unparse(node.value)
            except Exception:
                pass
        info[node.lineno] = entry
    return info


def run(source, limits=None):
    """Trace `source`; return a CodeLens ExecutionResult as a dict."""
    tracer = Tracer(limits)
    output = _Output(tracer)
    tracer.output = output
    tracer.statements = statement_info(source)
    result = {'events': tracer.events, 'output': [], 'error': None, 'status': 'completed'}

    try:
        code = compile(source, USER_FILE, 'exec')
    except SyntaxError as error:
        result['error'] = {'type': 'SyntaxError', 'message': error.msg, 'line': error.lineno}
        result['status'] = 'syntax-error'
        return result

    saved_stdout = sys.stdout
    sys.stdout = output
    sys.settrace(tracer.trace)
    try:
        exec(code, {'__name__': '__main__', '__builtins__': __builtins__})
    except _LimitReached as limit:
        result['status'] = 'limit'
        result['limit'] = {'kind': limit.kind, 'message': limit.message}
    except SystemExit:
        pass
    except RecursionError as error:
        result['status'] = 'limit'
        result['limit'] = {'kind': 'recursion', 'message': f'RecursionError: {error}'}
    except BaseException as error:   # the learner's own uncaught exception
        line = _user_line(error)
        result['status'] = 'runtime-error'
        result['error'] = {'type': type(error).__name__, 'message': str(error)}
        tracer.events.append({
            'stepId': len(tracer.events),
            'type': 'error_thrown',
            'language': 'python',
            'errorType': type(error).__name__,
            'message': str(error),
            'line': line,
            'sourceLocation': {'line': line} if line else None,
            'stackSnapshot': tracer.events[-1]['stackSnapshot'] if tracer.events else [],
            'heapDelta': [],
        })
    finally:
        sys.settrace(None)
        sys.stdout = saved_stdout
    result['output'] = output.lines()
    return result


def run_to_json(source, limits=None):
    """run() as a JSON string; what both hosts call."""
    return json.dumps(run(source, limits), ensure_ascii=False, default=str)
