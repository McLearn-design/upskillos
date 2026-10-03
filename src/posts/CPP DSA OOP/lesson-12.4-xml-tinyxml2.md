# Lesson 12.4: XML with `tinyxml2`

*Phase 12 — Persistence Layer: Files, JSON, XML, CSV, SQLite*

---

## An older format, still genuinely necessary in specific places

XML predates JSON by roughly a decade and, for a long stretch, was *the* dominant structured-data format on the web and in enterprise software. JSON has largely displaced it for new, general-purpose use — APIs, config files, data interchange — because it's more compact and maps more directly onto the data structures most languages already have (objects, arrays, primitives). XML remains genuinely necessary in specific, real domains worth naming honestly rather than dismissing the format outright: many enterprise systems (especially older ones, and specific industries like finance and healthcare, with regulatory standards built on XML schemas), Microsoft Office's `.docx`/`.xlsx`/`.pptx` file formats (literally a zip archive of XML files — the `pptx`, `docx`, and `xlsx` skills this curriculum's own tooling occasionally reaches for are working with exactly this format under the hood), Android app layouts, and SVG (scalable vector graphics) are all still genuinely XML-based today, not legacy holdovers. Understanding XML is a real, practical skill, not an academic exercise.

## What XML looks like, and how it differs structurally from JSON

```xml
<?xml version="1.0" encoding="UTF-8"?>
<person>
    <name>Alice</name>
    <age>30</age>
    <hobbies>
        <hobby>reading</hobby>
        <hobby>chess</hobby>
    </hobbies>
</person>
```

The same `Person` data as Lesson 12.3's JSON example, but structurally different in a way worth naming precisely: JSON has a built-in array type (`["reading", "chess"]`); XML has no equivalent — a list is represented as *repeated sibling elements* (`<hobby>reading</hobby><hobby>chess</hobby>`), with no structural marker distinguishing "this is meant to be a list" from "these just happen to be several different, unrelated tags that happen to share a name." This is a genuine, structural reason JSON tends to feel like a more natural fit for programming language data structures — JSON's shape (objects, arrays, primitives) maps almost directly onto a `struct` plus a `std::vector` plus primitive fields; XML's shape (nested tags, with *attributes* as a second, separate way to attach data, shown below) requires more interpretation to map onto the same structures.

## XML also has attributes — a second place to put data, which JSON lacks

```xml
<person id="42" active="true">
    <name>Alice</name>
</person>
```

`id` and `active` are **attributes** — data attached directly to the opening tag, distinct from **child elements** (`<name>`). This is a genuine extra degree of freedom XML offers that JSON doesn't have an equivalent for — and, honestly, a genuine extra source of ambiguity: should a given piece of data be an attribute or a child element? XML itself doesn't dictate an answer, and different schemas make different, sometimes inconsistent choices, a real, practical source of friction when working with XML from multiple sources.

## Reading XML with `tinyxml2`

```cpp
#include <tinyxml2.h>
#include <iostream>

int main() {
    tinyxml2::XMLDocument doc;
    tinyxml2::XMLError result = doc.LoadFile("person.xml");

    if (result != tinyxml2::XML_SUCCESS) {
        std::cerr << "Failed to load XML file" << std::endl;
        return 1;
    }

    tinyxml2::XMLElement* root = doc.FirstChildElement("person");
    if (root == nullptr) {
        std::cerr << "No <person> root element found" << std::endl;
        return 1;
    }

    const char* name = root->FirstChildElement("name")->GetText();
    int age = root->FirstChildElement("age")->IntText();   // built-in text-to-int conversion

    std::cout << "Name: " << name << ", Age: " << age << std::endl;

    // iterate over repeated <hobby> elements — note the DIFFERENT pattern from JSON's array iteration
    tinyxml2::XMLElement* hobbiesElem = root->FirstChildElement("hobbies");
    for (tinyxml2::XMLElement* hobby = hobbiesElem->FirstChildElement("hobby");
         hobby != nullptr;
         hobby = hobby->NextSiblingElement("hobby")) {
        std::cout << "Hobby: " << hobby->GetText() << std::endl;
    }

    return 0;
}
```

Notice the hobby-iteration loop's shape directly: `FirstChildElement` then repeated `NextSiblingElement` calls until `nullptr` — this is genuinely, structurally the **same traversal pattern as Lesson 5.1's linked list** (`head`, then repeated `next` until `nullptr`), because that's precisely what XML's sibling-element model actually is underneath: a linked structure, navigated node by node, rather than JSON's directly-indexable array. This is worth recognizing explicitly as a real, concrete payoff of Phase 5's investment — the exact traversal idiom you wrote by hand five phases ago reappears here, verbatim in shape, inside a real, widely-used third-party library's API design.

## Writing XML with `tinyxml2`

```cpp
#include <tinyxml2.h>

void savePersonXml(const std::string& name, int age,
                    const std::vector<std::string>& hobbies,
                    const std::string& filename) {
    tinyxml2::XMLDocument doc;

    tinyxml2::XMLElement* root = doc.NewElement("person");
    doc.InsertFirstChild(root);

    tinyxml2::XMLElement* nameElem = doc.NewElement("name");
    nameElem->SetText(name.c_str());
    root->InsertEndChild(nameElem);

    tinyxml2::XMLElement* ageElem = doc.NewElement("age");
    ageElem->SetText(age);
    root->InsertEndChild(ageElem);

    tinyxml2::XMLElement* hobbiesElem = doc.NewElement("hobbies");
    for (const auto& h : hobbies) {
        tinyxml2::XMLElement* hobbyElem = doc.NewElement("hobby");
        hobbyElem->SetText(h.c_str());
        hobbiesElem->InsertEndChild(hobbyElem);
    }
    root->InsertEndChild(hobbiesElem);

    doc.SaveFile(filename.c_str());
}
```

Notice this is genuinely more verbose than Lesson 12.3's JSON-building code — `j["name"] = p.name;` versus `NewElement`, `SetText`, `InsertEndChild`, three separate calls for one single field. This verbosity is a real, honest, structural consequence of XML's tree-of-elements model requiring explicit node creation and explicit parent-child wiring (Phase 7's `TreeNode` construction, essentially, by hand, for every single field) rather than JSON's more direct key-value assignment syntax. This verbosity gap is a genuine, concrete reason JSON has displaced XML for most new, general-purpose work — not a matter of taste, but a real difference in how much code the same data requires.

## Try it yourself

**1. Build both the reading and writing code above, round-trip a `Person` (with hobbies) through an XML file, and confirm every field survives correctly.**

**2. Add an attribute to the `<person>` element** (`root->SetAttribute("id", 42);` when writing, `root->IntAttribute("id")` when reading) and confirm you can read it back correctly — direct, hands-on practice with the attribute-versus-child-element distinction named above.

**3. Compare the same `Person` data's file size in XML versus Lesson 12.3's JSON output.** Confirm XML's closing tags (`</name>`, `</age>`, etc.) make it meaningfully larger for the same information — a real, measurable instance of the "JSON is more compact" claim, rather than an assertion to simply accept.

**4. Write a small function converting a `tinyxml2::XMLDocument` to an `nlohmann::json` object, for the `Person` structure specifically** (walk the XML tree, build the equivalent JSON object field by field). This is a genuinely practical, real-world task — converting between structured formats is common in systems that need to interoperate with both older XML-based services and newer JSON-based ones, and building this conversion by hand, once, cements both formats' structure in a way that just reading about them separately doesn't.

## What this cost / bought us

| | JSON (Lesson 12.3) | XML (this lesson) |
|---|---|---|
| Built-in array/list concept | Yes | No — repeated sibling elements only |
| Data attachment points | One (key-value) | Two (attributes and child elements) — more flexible, also more ambiguous |
| Typical file size for the same data | Smaller | Larger — explicit closing tags |
| Code verbosity for the same data | Lower | Higher — explicit tree construction |
| Where it remains genuinely necessary today | General-purpose APIs, configs | Office document formats, specific enterprise/regulatory standards, SVG |

Neither format is simply "worse" — JSON's simplicity and compactness won out for most new, general-purpose work, while XML's richer structure (attributes, namespaces, and schema-validation tooling beyond this lesson's scope) keeps it entrenched in the specific domains that adopted it early and built extensive tooling and standards around it. Knowing both, and knowing precisely why each one is shaped the way it is, is a genuinely practical, employable skill.

---

**Next up: Lesson 12.5 — SQLite via the `sqlite3` C API — your first real "database," no server needed.** A fundamentally different kind of persistence from everything in this phase so far: structured, queryable storage, rather than a format you parse and reconstruct by hand every time.
