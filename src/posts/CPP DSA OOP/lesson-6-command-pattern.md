# Design Pattern: Command — An Undo/Redo Text Editor

*Phase 6 — Stacks, Queues, Deques*
*Compare an OOP Command class hierarchy vs. a `std::function`-based version.*

---

## The need, stated plainly

Undo/redo is a genuinely common real-world feature — text editors, image editors, spreadsheets, IDEs, all need it. The core requirement: every action a user takes needs to be **reversible**, and the program needs to remember *what was done*, in order, so it can walk that history backward (undo) and forward again (redo). Lesson 6.1's stack — LIFO, exactly matching "undo the most recent thing first" — is the natural structure. The **Command pattern**'s idea: wrap every action as an object (or callable) that knows how to both *do* itself and *undo* itself, and manage a history of these using stacks.

## Version 1: an OOP `Command` class hierarchy

```cpp
class Command {
public:
    virtual ~Command() {}
    virtual void execute() = 0;
    virtual void undo() = 0;
};
```

Every concrete action the editor supports becomes its own class implementing this interface:

```cpp
class TextEditor {
public:
    std::string text;
};

class InsertCommand : public Command {
private:
    TextEditor& editor;
    std::string insertedText;
    int position;

public:
    InsertCommand(TextEditor& ed, const std::string& t, int pos)
        : editor(ed), insertedText(t), position(pos) {}

    void execute() override {
        editor.text.insert(position, insertedText);
    }

    void undo() override {
        editor.text.erase(position, insertedText.length());
    }
};

class DeleteCommand : public Command {
private:
    TextEditor& editor;
    std::string deletedText;   // must remember what was deleted, to undo correctly
    int position;

public:
    DeleteCommand(TextEditor& ed, int pos, int length)
        : editor(ed), position(pos) {
        deletedText = editor.text.substr(position, length);
    }

    void execute() override {
        editor.text.erase(position, deletedText.length());
    }

    void undo() override {
        editor.text.insert(position, deletedText);
    }
};
```

Notice `DeleteCommand`'s constructor: it captures `deletedText` **before** the deletion happens, by reading it out of the editor's current text. This is the whole discipline a `Command` needs: it must carry enough information, captured at the right moment, to fully reverse itself later — not just "know what to do," but "remember what it did."

```cpp
class CommandHistory {
private:
    VectorStack undoStack;   // reusing Lesson 6.1's stack — but this needs to hold
                               // Command*, not int; imagine a generic version here
    // (for illustration, treat these as if VectorStack were templated to hold Command*
    //  — real generic containers arrive properly in Phase 10)

public:
    void executeCommand(std::unique_ptr<Command> cmd) {
        cmd->execute();
        // push cmd onto the undo stack, clear the redo stack (a new action invalidates old redos)
    }

    void undo() {
        // pop from undo stack, call ->undo(), push onto redo stack
    }

    void redo() {
        // pop from redo stack, call ->execute(), push onto undo stack
    }
};
```

Notice `undo()`'s redo-stack push and `redo()`'s undo-stack push — undo and redo are, structurally, **two stacks working together**: doing a new action clears the redo stack (you can't "redo" something that's been superseded by a genuinely new edit); undoing moves a command from one stack to the other; redoing moves it back. This two-stack dance is the actual mechanism behind every undo/redo system you've ever used, in every piece of real software.

## Version 2: `std::function`-based commands

Instead of a class per action, store a pair of callables — one to do the action, one to undo it:

```cpp
#include <functional>

struct FunctionCommand {
    std::function<void()> execute;
    std::function<void()> undo;
};

FunctionCommand makeInsertCommand(TextEditor& editor, const std::string& text, int position) {
    return FunctionCommand{
        [&editor, text, position]() {               // execute — captures by value/reference as needed
            editor.text.insert(position, text);
        },
        [&editor, text, position]() {                 // undo
            editor.text.erase(position, text.length());
        }
    };
}

FunctionCommand makeDeleteCommand(TextEditor& editor, int position, int length) {
    std::string deletedText = editor.text.substr(position, length);   // capture BEFORE deletion, same discipline as Version 1
    return FunctionCommand{
        [&editor, position, deletedText]() {
            editor.text.erase(position, deletedText.length());
        },
        [&editor, position, deletedText]() {
            editor.text.insert(position, deletedText);
        }
    };
}
```

This is directly, recognizably the Strategy-pattern comparison from Phase 4, reapplied: no class hierarchy at all, just two lambdas per action, bundled together. The exact same "capture what you need before the state changes" discipline from Version 1 still applies — `deletedText` is still captured before the erase happens — the discipline is about the *problem*, not the implementation style, so it survives the translation intact.

## Comparing the two, honestly

| | OOP `Command` hierarchy | `std::function`-based |
|---|---|---|
| Adding a new action type | New class implementing `Command` | New factory function returning a `FunctionCommand` |
| State needed to undo | Fields on the class | Captured variables in the lambdas' closures |
| Memory per command | One vtable pointer (Lesson 4.2) + fields | Two `std::function` objects, each with their own small internal overhead |
| Code locality | Related `execute`/`undo` logic can be split across a whole class body | `execute`/`undo` for the same conceptual action sit right next to each other, visually, at the point of creation |
| Extending with shared behavior across all commands (e.g., logging every execute) | Natural — add it to the base class, or override consistently | Requires wrapping each lambda manually, or a separate mechanism entirely |
| Feels most natural when | You have many command *types*, each with real, distinct internal complexity | Commands are simple, and you want less ceremony per action |

Neither one is "the" right answer — this is, deliberately, the same conclusion Phase 4's Strategy comparison reached, because it's genuinely the same underlying design question (a family of interchangeable behaviors, wrapped as first-class values) wearing a text-editor's clothes instead of a sorting-comparator's.

## Try it yourself

**1. Build Version 1 fully, with a real, working `CommandHistory` (fill in the stack-juggling logic sketched above, using either `VectorStack` extended to hold `Command*`, or, more realistically, a `std::vector<std::unique_ptr<Command>>` used stack-style with `.push_back()`/`.pop_back()`).** Test a sequence: insert some text, delete some text, undo twice, redo once, and print the editor's text after each step to confirm correctness.

**2. Build Version 2 fully**, with `CommandHistory` adapted to hold `FunctionCommand` values instead of `Command*` pointers — notice this version needs no `virtual`, no base class, no heap allocation of command objects at all (`FunctionCommand` can live by value on whichever stack holds it). Run the identical test sequence from step 1 and confirm identical output.

**3. Add a third action type — "replace text at position X with new text Y"** — to *both* versions, and count how many new lines of code each required, and whether anything about `CommandHistory` itself needed to change in either version. (It shouldn't, in either — that's the Strategy/Command pattern's whole point, reaffirmed a second time in this phase.)

**4. A genuinely important edge case to handle in either version: what happens if `undo()` is called with an empty undo stack, or `redo()` with an empty redo stack?** Add the appropriate `isEmpty()` checks (Lesson 6.1 already gave you this method) and confirm your program handles repeated undo/redo presses gracefully rather than crashing — a real, easy-to-forget requirement in genuine undo/redo implementations.

## What this cost / bought us

This pattern, like Strategy before it, costs nothing conceptually new — `virtual`, abstract classes, lambdas, and `std::function` were all already in your toolkit. What it bought you is recognizing a genuinely common, real-world shape: **whenever an action needs to be both performed and reversed, and you need a history of such actions, wrap each action as an object (or callable pair) carrying everything it needs to undo itself, and manage the history with two stacks, working in careful opposition.** You will recognize this shape again the moment you encounter any "undo" button in any real software you use — which, now, is essentially every piece of real software you'll ever touch.

---

**Phase 6 is complete.** Stacks, queues, circular buffers, `std::deque`'s real internals, and your second design pattern, comparing the same design decision from Phase 4 (class hierarchy vs. first-class functions) in a genuinely different, practical context.

**Next up: Phase 7 — Trees, Recursion, and the Iterator Pattern.** New territory again: hierarchical structures, revisiting recursion with the call stack finally visible (a direct callback to Lesson 1.1's stack frames), and two more design patterns — Iterator, the lesson this curriculum has been quietly building toward since Lesson 0.5's range-based for loops, and Visitor.
