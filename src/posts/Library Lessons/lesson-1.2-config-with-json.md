# Lesson 1.2: A Config System with `json`

**Library:** `json` (standard library), plus `pathlib` from last lesson
**You will build:** a settings module for the file organizer, so its rules live in an editable file
**Time:** about 75 minutes
**Prerequisites:** Lesson 1.1 (you need your working `organizer.py`), Lesson 0.2 (modules)

**What survives if you throw `json` away:** serialization (turning in-memory data into text and back), and the habit of merging user settings over defaults.

---

## The problem

In Lesson 1.1 the extension-to-folder rules were hard-coded in `organizer.py`. To add `.png` you have to edit Python. A friend who doesn't program can't tweak it, and a mistake in the edit can break the whole script.

The rules are *data*. Data should live in a file that anyone can edit and that your program reads.

## The core idea: serialization

Your program holds data as live objects in memory: dictionaries, lists, numbers. A file holds only text (or bytes). **Serialization** is the translation between the two:

- **Serialize** (a.k.a. encode, dump): memory object → text
- **Deserialize** (a.k.a. decode, load, parse): text → memory object

JSON is one agreed-upon text format for this. It only has a small set of types:

| JSON | Python |
| --- | --- |
| object `{}` | `dict` |
| array `[]` | `list` |
| string | `str` |
| number | `int` or `float` |
| `true` / `false` | `True` / `False` |
| `null` | `None` |

Anything that doesn't fit this table either fails or silently changes shape. You'll see both below.

**Mental model:** `json` has four functions, and the names follow one pattern. The trailing **s** means "string":

| | to text | from text |
| --- | --- | --- |
| **in memory (string)** | `json.dumps(obj)` | `json.loads(text)` |
| **to/from an open file** | `json.dump(obj, file)` | `json.load(file)` |

This lesson uses the string versions together with `pathlib`'s `read_text` and `write_text`, which keeps the file handling visible.

---

## Part 1: See the translation

Create `json_playground.py` (a throwaway; the project files come later). Type and run:

```python
import json

settings_in_python = {
    "fallback_folder_name": "other",
    "ignore_hidden_files": True,
    "folders_by_extension": {".pdf": "documents", ".jpg": "images"},
}

text_form = json.dumps(settings_in_python)
print(type(text_form))
print(text_form)
```

The result is a plain `str`. Notice `True` became `true`. Now make it readable:

```python
print(json.dumps(settings_in_python, indent=2))
```

Then go the other way:

```python
dictionary_again = json.loads(text_form)
print(type(dictionary_again))
print(dictionary_again == settings_in_python)
```

Round trip: out and back, and the data is equal. Check that `True` came back as `True`.

## Part 2: Where the translation leaks

Add these one at a time and predict the output **before** you run each:

```python
print(json.loads(json.dumps({"coordinates": (3, 4)})))
```

The tuple came back as a list. JSON has no tuples.

```python
print(json.loads(json.dumps({1: "one", 2: "two"})))
```

The integer keys came back as strings. JSON object keys are always strings.

```python
try:
    json.dumps({"tags": {"red", "blue"}})
except TypeError as error:
    print("Failed:", error)
```

Sets can't be serialized at all. It fails loudly, which is better than silently changing.

These aren't bugs in the library. They're the cost of using a format other programs and languages can read, and part of the API you must know about.

## Part 3: Put it in a file

Now the real module. Create `organizer_config.py` next to `organizer.py`:

```python
import json
from pathlib import Path

DEFAULT_SETTINGS = {
    "fallback_folder_name": "other",
    "ignore_hidden_files": True,
    "folders_by_extension": {
        ".pdf": "documents",
        ".txt": "documents",
        ".jpg": "images",
        ".mp3": "audio",
        ".csv": "spreadsheets",
        ".zip": "archives",
    },
}


def save_settings(settings_dictionary, config_file_path):
    text_to_write = json.dumps(settings_dictionary, indent=2)
    config_file_path.write_text(text_to_write)


def load_settings(config_file_path):
    text_from_file = config_file_path.read_text()
    return json.loads(text_from_file)
```

Constants written in ALL_CAPS are a convention for "this value is not supposed to change."

Test it from a scratch file `try_config.py`:

```python
from pathlib import Path
import organizer_config

config_path = Path("organizer_settings.json")
organizer_config.save_settings(organizer_config.DEFAULT_SETTINGS, config_path)
print(config_path.read_text())
print(organizer_config.load_settings(config_path))
```

Open `organizer_settings.json` in your editor. That's the file a non-programmer can edit.

## Part 4: Handle missing and partial files

Real users delete files, make typos, and write config that only mentions *some* settings. Your loader must cope. Replace `load_settings` with this version, building it up line by line:

First the missing file case:

```python
def load_settings(config_file_path):
    if not config_file_path.exists():
        save_settings(DEFAULT_SETTINGS, config_file_path)
        return dict(DEFAULT_SETTINGS)
```

If there's no config, write the defaults out (so the user has a file to edit) and return them.

Next, the file exists but might be broken. Add:

```python
    try:
        settings_from_file = json.loads(config_file_path.read_text())
    except json.JSONDecodeError as error:
        raise ValueError(f"{config_file_path} is not valid JSON: {error}") from error
```

`json.JSONDecodeError` is the library's way of saying "I couldn't parse this." You catch it and re-raise as a message your user can act on, with the filename. Library errors tell you what went wrong inside the library; your errors should say what the *user* needs to fix.

Finally, partial files: if the user's file only mentions `ignore_hidden_files`, everything else should come from the defaults:

```python
    merged_settings = dict(DEFAULT_SETTINGS)
    merged_settings.update(settings_from_file)
    return merged_settings
```

`dict.update` copies keys from one dictionary into another, with the incoming values winning.

### A trap you should trigger on purpose

`dict(DEFAULT_SETTINGS)` makes a **shallow** copy: a new outer dictionary, but the *inner* dictionaries are shared with the original. Prove it in `try_config.py`:

```python
first_settings = organizer_config.load_settings(Path("missing_file.json"))
first_settings["folders_by_extension"][".xyz"] = "oops"
print(organizer_config.DEFAULT_SETTINGS["folders_by_extension"])
```

The default was modified through the copy. Delete `missing_file.json` that this created. Now fix it in `organizer_config.py`: add `import copy` at the top, and replace both `dict(DEFAULT_SETTINGS)` calls with `copy.deepcopy(DEFAULT_SETTINGS)`. Run the experiment again (delete `missing_file.json` first) and confirm the defaults stay clean.

## Part 5: Wire it into the organizer

Open `organizer.py` from Lesson 1.1 and make three edits.

**1.** At the top, add:

```python
import organizer_config
```

**2.** Delete the `folder_name_for_extension` dictionary. Change the lookup function so it receives the settings:

```python
def destination_folder_name_for(file_path, settings):
    lowercase_extension = file_path.suffix.lower()
    return settings["folders_by_extension"].get(
        lowercase_extension, settings["fallback_folder_name"]
    )
```

**3.** Update `organize_folder` to take the settings, use them, and skip hidden files when asked:

```python
def organize_folder(target_folder_path, settings):
    files_to_move = [
        item_path for item_path in target_folder_path.iterdir()
        if item_path.is_file()
        and not (settings["ignore_hidden_files"] and item_path.name.startswith("."))
    ]

    for file_path in files_to_move:
        destination_folder_name = destination_folder_name_for(file_path, settings)
        destination_folder_path = target_folder_path / destination_folder_name
        destination_folder_path.mkdir(exist_ok=True)
        file_path.rename(destination_folder_path / file_path.name)
        print("Moved", file_path.name, "->", destination_folder_name)
```

At the bottom of the file, replace the old last line with:

```python
current_settings = organizer_config.load_settings(Path("organizer_settings.json"))
organize_folder(sandbox_folder, current_settings)
```

Delete the `sandbox` folder and run. Then edit `organizer_settings.json` by hand: change `".jpg"` to map to `"photos"`, delete the sandbox again, and run once more. The behavior changed and you didn't touch Python.

---

## Break it

1. **Trailing comma.** Add a comma after the last entry in the JSON file. Run. JSON is stricter than Python. Read your own error message.
2. **Wrong type.** Change `"ignore_hidden_files"` to the string `"no"`. Run. Does it behave as intended? (A non-empty string is truthy in Python.) The library parsed the file *correctly*. The content is still wrong. Parsing is not validation.
3. **Typo'd key.** Rename `"fallback_folder_name"` to `"fallback_folder"`. Run. Defaults fill in silently, and the user's setting is ignored. Is that kind or confusing?

---

## Explore (guided)

Copy `organizer_config.py` to `organizer_config_toml.py` and work in the copy.

1. Python 3.11+ ships `tomllib`, a reader for TOML, a config format designed for humans. Write the same defaults into `organizer_settings.toml` by hand, with comments (JSON can't have comments; try adding one to the JSON file and see what happens).
2. Change `load_settings` to read it: `tomllib.loads(path.read_text())`. Note which of the `json` calls it mirrors.
3. Look at the `tomllib` docs for a *writer*. What do you find, and what does that suggest about how the format is meant to be used?

Return to the JSON version once you've compared them. Then go further: look up how other tools you use store their configuration (a text editor, a Git config) and which format they picked.

---

## Challenge

Parsing isn't validation. Write `check_settings(settings)` in `organizer_config.py` that raises `ValueError` with a **specific, helpful message** when:

- `ignore_hidden_files` is not a `bool`
- `fallback_folder_name` is not a non-empty `str`
- `folders_by_extension` is not a `dict`, or any of its keys doesn't start with a `.`, or any of its values isn't a non-empty `str`
- the settings contain a key that isn't one of the three known ones (a likely typo)

Call it at the end of `load_settings` so every load is checked. Then verify each failure case by editing the JSON file.

Hint: think about what your message should say. A good one names the setting, what was expected, and what was found.

Solution is in `solutions/solutions-batch-1.md`.

---

## What you should now be able to say

- Serialization translates between live objects and text, and JSON's type table defines what survives.
- `dumps`/`loads` are for strings; `dump`/`load` are for files.
- Defaults plus a deep merge makes partial config files work.
- A parser tells you the text is well-formed; it can't tell you the content makes sense.

**Next:** Level 1 continues with `csv`, `re` and `argparse`, and then Level 2 introduces your first external dependency.
