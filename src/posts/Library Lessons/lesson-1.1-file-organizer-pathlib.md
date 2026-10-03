# Lesson 1.1: File Organizer with `pathlib`

**Library:** `pathlib` (standard library)
**You will build:** a script that sorts a messy folder into subfolders by file type
**Time:** about 75 minutes
**Prerequisites:** Lessons 0.1 and 0.2, dictionaries, loops

**What survives if you throw `pathlib` away:** the idea that a path is a *thing with parts and behaviors*, not just a string you glue together.

---

## The problem

A downloads folder fills up with PDFs, photos, spreadsheets, and zip files, all mixed together. You want a script that moves each file into a folder named for its type.

## The naive version: paths as strings

Before meeting the library, look at what the older style costs you. This is **read-only; don't type it**:

```python
folder = "sandbox"
file_name = "report.pdf"
full_path = folder + "/" + file_name          # breaks on Windows
extension = file_name.split(".")[-1]          # breaks on "README" and "archive.tar.gz"
```

Every line is a small bug waiting to happen. You are manually doing three jobs: joining parts with the right separator, picking apart a name, and remembering which functions to call on the string (`os.path.exists`, `os.listdir`, `os.rename`...), none of which are attached to the string itself.

## Meet the library

`pathlib` makes a path an **object**. An object bundles data (the path) with behaviors (methods that act on it). Then:

- Joining uses an operator: `folder / "report.pdf"`.
- Taking apart uses attributes: `.name`, `.stem`, `.suffix`, `.parent`.
- Acting on the filesystem uses methods: `.exists()`, `.mkdir()`, `.rename()`, `.iterdir()`.

**Mental model:** `Path` → *parts* (name, suffix, parent) → *questions* (exists? is it a file?) → *actions* (create, move, list).

Two kinds of thing to keep apart as you work:

| Pure operations (never touch the disk) | Disk operations (change or read reality) |
| --- | --- |
| `/`, `.name`, `.suffix`, `.stem`, `.parent` | `.exists()`, `.mkdir()`, `.rename()`, `.iterdir()`, `.touch()` |

You can build and inspect a path to a file that doesn't exist. Nothing happens until you call a disk operation.

---

## Part 1: Build and inspect paths

Create `organizer.py`. Type this and run it:

```python
from pathlib import Path

sandbox_folder = Path("sandbox")
print(sandbox_folder)
print(type(sandbox_folder))
print(sandbox_folder / "notes" / "todo.txt")
```

The `/` is not division. `Path` defines what `/` means for it, which is "join these." Python lets classes define their own meaning for operators.

Now pull apart a path. Add:

```python
example_path = Path("sandbox/vacation.photos.JPG")
print(example_path.name)
print(example_path.stem)
print(example_path.suffix)
print(example_path.parent)
```

Predict each line before running. Pay attention to `stem` versus `suffix` when the filename has two dots.

None of these touched the disk. `sandbox` doesn't exist yet.

## Part 2: Create the mess

You need files to organize. Add this below (keep adding to the same file):

```python
sample_file_names = [
    "report.pdf", "photo.jpg", "vacation.JPG", "song.mp3",
    "notes.txt", "budget.csv", "archive.zip", "README",
]

sandbox_folder.mkdir(exist_ok=True)

for sample_file_name in sample_file_names:
    (sandbox_folder / sample_file_name).touch()
```

New calls:

- `.mkdir(exist_ok=True)` creates the folder. Without `exist_ok=True`, running the script twice would crash because the folder already exists. Check the signature with `help(Path.mkdir)` to see the other options (`parents`).
- `.touch()` creates an empty file, like the shell command.

Run it, then look at your folder in a file manager. Eight empty files.

## Part 3: List and inspect what's there

Add:

```python
for item_path in sandbox_folder.iterdir():
    print(item_path.name, "|", item_path.suffix, "|", item_path.is_file())
```

`.iterdir()` yields every item directly inside the folder (files *and* subfolders). The order is arbitrary, so don't rely on it.

Look carefully at two rows: `README` and `vacation.JPG`. One has no suffix; the other has capitals. Your organizer must handle both.

## Part 4: Decide where each file goes

The rule is data, not logic, so put it in a dictionary. Add:

```python
folder_name_for_extension = {
    ".pdf": "documents",
    ".txt": "documents",
    ".jpg": "images",
    ".mp3": "audio",
    ".csv": "spreadsheets",
    ".zip": "archives",
}
```

Now a function that looks it up:

```python
def destination_folder_name_for(file_path):
    lowercase_extension = file_path.suffix.lower()
    return folder_name_for_extension.get(lowercase_extension, "other")
```

Two things to understand:

- `.lower()` makes `.JPG` match `.jpg`.
- `dictionary.get(key, fallback)` returns the fallback instead of raising an error when the key is missing. That's how `README` (suffix `""`) lands in `"other"`.

Test it without touching the disk:

```python
print(destination_folder_name_for(Path("sandbox/vacation.JPG")))
print(destination_folder_name_for(Path("sandbox/README")))
```

You can test it on a path to a file that doesn't exist. That's the payoff of separating pure operations from disk operations.

## Part 5: Move one file

Before looping, prove the move works for a single file. Add:

```python
one_file_path = sandbox_folder / "report.pdf"
destination_folder_path = sandbox_folder / destination_folder_name_for(one_file_path)
destination_folder_path.mkdir(exist_ok=True)
one_file_path.rename(destination_folder_path / one_file_path.name)
```

Run it and check the folder: `report.pdf` should now be inside `sandbox/documents/`.

Note `.rename(new_path)` takes the *full new path*, including the filename, not just the destination folder. This surprises almost everyone once.

Run the script a second time. What happens? (The file is already gone from its old location, so `rename` fails. Hold that thought for the Break it section.)

## Part 6: Make it a function

Delete the "one file" block and the `.iterdir()` printing loop. Replace them with:

```python
def organize_folder(target_folder_path):
    files_to_move = [
        item_path for item_path in target_folder_path.iterdir()
        if item_path.is_file()
    ]

    for file_path in files_to_move:
        destination_folder_path = target_folder_path / destination_folder_name_for(file_path)
        destination_folder_path.mkdir(exist_ok=True)
        file_path.rename(destination_folder_path / file_path.name)
        print("Moved", file_path.name, "->", destination_folder_path.name)


organize_folder(sandbox_folder)
```

Why build the list first? Because moving files while iterating over the folder changes what you're iterating over. Collect, then act.

Why the `is_file()` filter? After the first run, the folder contains subfolders. You don't want to try to "move" `documents` into `other`.

To re-run from scratch, delete the `sandbox` folder first, since your script recreates the mess each time. Run it. All files should be sorted.

---

## Break it

1. **Run twice without deleting.** The script recreates the empty sample files in `sandbox/`, so the second run moves them again. Does it overwrite what's already in `documents/`? On Linux and macOS, `rename` replaces an existing file silently. On Windows it raises an error. Either way, your organizer has a data-loss bug. That is the challenge below.
2. **Wrong folder.** Call `organize_folder(Path("does_not_exist"))`. Read the error. Which method raised it?
3. **A path that's a string.** Call `organize_folder("sandbox")`. Which attribute is missing, and why? A string has no `.iterdir()`. A library's objects are not interchangeable with the primitives they wrap.

---

## Explore (guided)

Copy `organizer.py` to `organizer_explore.py`. Delete the `sandbox` folder before each experiment. In the copy only:

1. **Swap `iterdir()` for `glob("*.jpg")`** inside `organize_folder` and run. Which files get matched? Then try `glob("*.JPG")`. Is matching case-sensitive on your system?
2. **Swap in `rglob("*")`** and run the script **twice** on the same folder. What changes the second time, and why is that dangerous?
3. **Rebuild the same function with strings only**, using `os.listdir`, `os.path.join`, `os.path.isfile`, `os.path.splitext`, and `os.rename`. Compare line counts and readability. This is the "remove the library" exercise: it shows what `pathlib` is buying you.

Return to `organizer.py` when finished. Once you can explain each difference, go further on your own: look up `Path.rglob`, `Path.resolve`, and `Path.home`, and see what the official docs say about when `pathlib` operations differ across operating systems.

---

## Challenge

Fix the data-loss bug. If the destination already contains a file with the same name, the incoming file must **not** replace it. Instead, give it a numbered name: `report.pdf` becomes `report_1.pdf`, then `report_2.pdf`, and so on, using the first number that's free.

Requirements:

- Write a function `find_free_destination(destination_folder_path, original_file_name)` that returns a `Path` that does not currently exist.
- Use `.stem` and `.suffix` to build the new names. Do not split strings manually.
- Look in the `pathlib` docs for a method that builds a new path by replacing the filename. There are two close candidates; decide which fits.
- Test it by running the script twice on a freshly recreated sandbox *without* deleting the sorted folders in between.

Solution is in `solutions/solutions-batch-1.md`.

---

## What you should now be able to say

- A `Path` is an object with parts, questions, and actions.
- Pure path operations never touch the disk; disk operations do.
- Rules like extension-to-folder belong in data, not scattered `if` statements.
- "Collect, then act" avoids changing what you're iterating over.

**Next:** Lesson 1.2, where the extension-to-folder rules move out of the code and into a file that you can edit without touching Python.
