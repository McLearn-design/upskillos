# Lesson 7.7: Tries

*Phase 7 — Trees, Recursion, and the Iterator Pattern*
*Built from a dictionary word list loaded from a file.*

---

## A tree shaped by the alphabet, not by comparison

Every tree so far in this phase has had a fixed number of children per node — two, for a binary tree or BST. A **trie** (pronounced "try," from re**trie**val) throws that away: each node can have as many children as there are possible next characters — 26, for lowercase English letters, one edge per possible letter. Instead of organizing values by comparison (`<`, `>`, the BST's whole basis), a trie organizes strings by their **shared prefixes** — every path from the root spells out a prefix, character by character, and multiple words sharing a prefix literally share that portion of the path.

## The structure

```cpp
#include <unordered_map>
#include <memory>

class TrieNode {
public:
    std::unordered_map<char, std::unique_ptr<TrieNode>> children;   // one entry per next-letter
    bool isEndOfWord;   // marks: a real word ends exactly here, not just a prefix of one

    TrieNode() : isEndOfWord(false) {}
};
```

`std::unordered_map<char, std::unique_ptr<TrieNode>>` — a hash map (full mechanics in Phase 8; for now, treat it as "look up a child by character, O(1) on average") from each possible next character to the child node representing "the string so far, plus this character." `isEndOfWord` is the detail that makes tries genuinely need thought: without it, there'd be no way to distinguish "the string 'cat' was inserted" from "'cat' merely happens to be a prefix of 'catalog', which was inserted" — both would create identical paths through the tree, and only this flag, set specifically on the node at the end of a real inserted word, tells them apart.

## Insert

```cpp
class Trie {
private:
    std::unique_ptr<TrieNode> root;

public:
    Trie() : root(std::make_unique<TrieNode>()) {}

    void insert(const std::string& word) {
        TrieNode* current = root.get();
        for (char c : word) {
            if (current->children.find(c) == current->children.end()) {
                current->children[c] = std::make_unique<TrieNode>();   // no path for this letter yet — create it
            }
            current = current->children[c].get();
        }
        current->isEndOfWord = true;   // mark: a real word ends HERE
    }
};
```

Walk character by character; if a child for the current character doesn't exist yet, create it. This means inserting "cat" and then "car" builds a shared path for `c` → `a`, then branches into two separate children (`t` and `r`) at the third letter — the shared prefix is stored exactly once, not duplicated per word, which is the whole structural payoff of a trie for a dictionary full of related words.

## Search — exact word, versus prefix check

```cpp
bool search(const std::string& word) {
    TrieNode* current = root.get();
    for (char c : word) {
        auto it = current->children.find(c);
        if (it == current->children.end()) return false;   // path doesn't exist at all
        current = it->second.get();
    }
    return current->isEndOfWord;   // path exists, but is it a REAL word, or just a prefix?
}

bool startsWith(const std::string& prefix) {
    TrieNode* current = root.get();
    for (char c : prefix) {
        auto it = current->children.find(c);
        if (it == current->children.end()) return false;
        current = it->second.get();
    }
    return true;   // path exists — SOMETHING in the trie starts with this prefix
}
```

`search` and `startsWith` are nearly identical — both walk the exact same path-following logic — but `search`'s final check (`current->isEndOfWord`) is exactly what `startsWith` deliberately skips. This is the direct payoff of separating "a path exists" from "a real word ends here": a single trie structure answers both "is this a word?" and "does anything start with this?" using essentially the same traversal, a genuinely useful pair of operations that a BST or hash map (Phase 8) can't offer together nearly as cleanly — a hash map can answer "is this exact string present?" in O(1), but has no efficient way at all to answer "does anything start with this prefix?" without checking every entry.

## Complexity — a genuinely different shape than every earlier structure

Both `insert` and `search` are **O(L)**, where L is the length of the word being inserted or searched — **not** O(log n) or O(n) relative to how many words are already in the trie at all. This is worth sitting with directly: a trie holding 10 words or 10 million words takes exactly the same time to search for a given word, as long as that word's own length is the same — because the traversal only ever depends on the word's own character sequence, never on how much other data happens to be stored elsewhere in the structure. This is a genuinely different complexity shape from every prior structure in this curriculum, where operation cost has always scaled with n (the total stored element count) in some way.

## Loading a real dictionary from a file — the recurring project thread, paid off directly

### Step 1: get a word list with Python

```python
# A tiny sample dictionary — in practice you might download a real word list,
# but this keeps the exercise self-contained and reproducible.
import random

sample_words = [
    "cat", "car", "card", "care", "careful", "dog", "dodge", "do",
    "trie", "tree", "try", "true", "trust", "trie", "trip"
]

with open("dictionary.txt", "w") as f:
    for word in sample_words:
        f.write(word + "\n")

print(f"Wrote {len(sample_words)} words to dictionary.txt")
```

### Step 2: load it into a real trie

```cpp
#include <iostream>
#include <fstream>
#include <string>

int main() {
    std::ifstream file("dictionary.txt");   // Phase 2's <fstream>, unchanged
    if (!file.is_open()) {
        std::cerr << "Could not open dictionary.txt" << std::endl;
        return 1;
    }

    Trie trie;
    std::string word;
    while (std::getline(file, word)) {
        trie.insert(word);
    }

    std::cout << "search('car'): "        << trie.search("car")        << std::endl;   // 1 (true)
    std::cout << "search('ca'): "         << trie.search("ca")         << std::endl;   // 0 (false — prefix only)
    std::cout << "startsWith('ca'): "     << trie.startsWith("ca")     << std::endl;   // 1 (true)
    std::cout << "search('trie'): "       << trie.search("trie")       << std::endl;   // 1 (true)
    std::cout << "startsWith('xyz'): "    << trie.startsWith("xyz")    << std::endl;   // 0 (false)

    return 0;
}
```

Confirm the distinction between `search("ca")` and `startsWith("ca")` directly — `"ca"` is a genuine prefix of several dictionary words (`"cat"`, `"car"`, `"card"`, `"care"`, `"careful"`) but was never itself inserted as a complete word, so `search` correctly reports `false` while `startsWith` correctly reports `true`. This is the exact `isEndOfWord` distinction from earlier in the lesson, now proven against real, file-loaded data rather than a toy example.

## Try it yourself

**1. Build the full `Trie` above, load `dictionary.txt`, and run all five confirming checks from Step 2**, verifying each output matches its comment.

**2. Add a `std::vector<std::string> wordsWithPrefix(const std::string& prefix)` method** — a genuinely practical, real-world trie use case (this is exactly how autocomplete/typeahead suggestions work in real search boxes and IDEs). Implement it by first walking to the node representing `prefix` (reusing `startsWith`'s traversal logic), then doing a full traversal (any of Lesson 7.2's patterns, generalized to an arbitrary number of children) from that node downward, collecting every complete word found.

**3. Measure the "search cost independent of dictionary size" claim directly.** Build a trie from a large word list (a real system dictionary file, if your system has one — often at `/usr/share/dict/words` on Linux/macOS — or generate a large synthetic one with Python) and time searching for words of a fixed length (say, 5 characters) against both a small trie (100 words) and a large one (100,000+ words). Confirm the search times are roughly equal — direct, measured proof of the O(L)-not-O(n) claim.

**4. Compare a trie's memory usage against a plain `std::unordered_set<std::string>` holding the same words** (a hash-based approach — full mechanics next phase). For a dictionary with many words sharing common prefixes, the trie can use meaningfully *less* memory (shared prefix storage) or meaningfully *more* (one node, plus a hash map, per character of every word) depending on the specific data — this is a genuinely open-ended, real engineering question worth investigating rather than assuming an answer either way.

## What this cost / bought us

| | BST (Lesson 7.4) | Hash map (Phase 8, preview) | Trie (this lesson) |
|---|---|---|---|
| Exact-match search | O(log n) | O(1) average | O(L) — length of the word, not dataset size |
| Prefix search ("does anything start with X?") | Not efficiently supported | Not efficiently supported at all | **O(L)** — a natural, first-class operation |
| Ordering by comparison | Yes | No | No — ordering is alphabetical-by-construction, not comparison-based |
| Shared-prefix storage efficiency | No sharing | No sharing | Explicit, automatic sharing of common prefixes |

A trie is this phase's clearest example of a data structure shaped entirely around the *specific kind of data* it holds — strings, with meaningful internal structure (character sequences, shared prefixes) that a general-purpose comparison-based structure like a BST simply can't exploit. This is a genuinely important, recurring lesson for the rest of your work in this field: the right data structure often isn't the most general one, but the one that fits the actual shape of the problem in front of you.

---

**Phase 7's core lessons are complete.**

**Next up: the Iterator pattern — give your BST a proper C++ iterator (`begin()`/`end()`), so you can use range-based for loops and STL algorithms on your own tree, exactly the way you already can on `std::vector`.** This is the lesson Lesson 0.5's very first range-based for loop has been quietly building toward the entire curriculum.
