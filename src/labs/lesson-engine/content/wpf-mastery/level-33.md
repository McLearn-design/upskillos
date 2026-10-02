---
series: wpf-mastery
level: 33
title: Files, Settings and JSON
lang: csharp
---

# Files, Settings and JSON

Close an app and open it again: the window should be the same size, the theme the same, the recent files still listed. That means saving data to a file, and three questions come with it. **Where** does a desktop app keep its files? (Not next to the `.exe`.) **What format?** (JSON, through .NET's built-in `System.Text.Json`.) And **what happens when the file is missing, from an older version, or half-written** because the app crashed mid-save? This lesson answers each with measurements: the folders Windows gives an app, exactly what the serializer writes and reads (including one default that silently loses settings), the errors bad files produce, and a save that a crash can't corrupt. You'll write a settings store that survives all of it, and produce JSON in an exact agreed shape.

## Where an App Keeps Its Files

An installed app's own folder (under `C:\Program Files`) is **read-only** for normal users, and is replaced on every update, so a program must not write its data there. Windows gives each user folders for application data, found with **`Environment.GetFolderPath`**:

```project console file=Program.cs
string roaming = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
Console.WriteLine($"ApplicationData:      {roaming}");
Console.WriteLine($"LocalApplicationData: {local}");
Console.WriteLine($"this program runs from: {AppContext.BaseDirectory}");

string appFolder = Path.Combine(local, "UpSkillDemo");   // a real app would now call Directory.CreateDirectory(appFolder)
string settingsFile = Path.Combine(appFolder, "settings.json");
Console.WriteLine($"settings would go in: {settingsFile}");
```

The output, on the PC these outputs come from (yours shows your user name):

```text
ApplicationData:      C:\Users\g4m3r\AppData\Roaming
LocalApplicationData: C:\Users\g4m3r\AppData\Local
this program runs from: C:\Users\g4m3r\AppData\Local\Temp\oc-r\runtimes\dotnet\scratch\...\out\
settings would go in: C:\Users\g4m3r\AppData\Local\UpSkillDemo\settings.json
```

- **`ApplicationData`** (`AppData\Roaming`) is for small settings that should follow the user to another PC on a network that roams profiles.
- **`LocalApplicationData`** (`AppData\Local`) is for data tied to this machine: caches, databases (level 34), large files, window positions.
- **`Path.Combine`** joins path parts with the right separator; never build paths by concatenating strings with `"\\"`.
- **`Directory.CreateDirectory`** creates the folder, and its parents, if they don't exist, and does nothing if they do, so it's safe to call every time.

Always add a folder named after your app: `AppData\Local` is shared by every program the user has.

## JSON with System.Text.Json

**JSON** is the standard text format for structured data: objects in `{ }` with `"name": value` pairs, arrays in `[ ]`, strings, numbers, `true`, `false` and `null`. .NET's **`System.Text.Json`** turns objects into JSON and back:

- **`JsonSerializer.Serialize(obj, options)`** returns the JSON text for `obj`;
- **`JsonSerializer.Deserialize<T>(json, options)`** builds a `T` from JSON text;
- **`JsonSerializerOptions`** controls the details: `WriteIndented`, `PropertyNamingPolicy`, converters, and more.

It works by reflection (level 2) over the type's **public properties**, the same rule as data binding (level 15):

```project console file=Program.cs
using System.Text.Json;
using System.Text.Json.Serialization;

var settings = new Settings { Theme = Theme.Dark, FontSize = 14, RecentFiles = { "notes.txt" }, LastOpened = new DateTime(2026, 3, 9, 14, 30, 0) };

Console.WriteLine(JsonSerializer.Serialize(settings));

var readable = new JsonSerializerOptions
{
    WriteIndented = true,
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    Converters = { new JsonStringEnumConverter() },
};
Console.WriteLine(JsonSerializer.Serialize(settings, readable));

public enum Theme { Light, Dark }

public class Settings
{
    public Theme Theme { get; set; }
    public double FontSize { get; set; } = 12;
    public List<string> RecentFiles { get; set; } = new();
    public DateTime LastOpened { get; set; }
    public string Note = "a public field";
    private string Secret { get; set; } = "a private property";
}
```

`JsonNamingPolicy.CamelCase` writes `FontSize` as `fontSize`, the usual style in JSON. `JsonStringEnumConverter` writes enums by name. The output:

```text
{"Theme":1,"FontSize":14,"RecentFiles":["notes.txt"],"LastOpened":"2026-03-09T14:30:00"}
{
  "theme": "Dark",
  "fontSize": 14,
  "recentFiles": [
    "notes.txt"
  ],
  "lastOpened": "2026-03-09T14:30:00"
}
```

Read the first line closely:

- **Neither the public field `Note` nor the private property is written.** Only public properties are, unless you add `[JsonInclude]` or set `IncludeFields`.
- **The enum is written as a number**, `1`, by default. Numbers are fragile: insert a new theme between `Light` and `Dark` and every saved file now means something else. Write enums by name.
- **A `DateTime` is written in ISO 8601** (`2026-03-09T14:30:00`), which every language can read.

## Reading JSON: What Goes Wrong

Reading is where files from the real world meet your types. Measured, deserializing into the `Settings` class above:

| The JSON | Result |
|---|---|
| `{"theme":1,"fontSize":20}` with default options | **no error, and `FontSize` is 12, `Theme` is `Light`: the values were silently ignored** |
| the same, with `PropertyNameCaseInsensitive = true` | `FontSize` 20, `Theme` `Dark` |
| `{"FontSize":18,"Unknown":true}` | `FontSize` 18; the unknown property is ignored, and missing ones keep their defaults |
| `{"FontSize": "big"}` | `JsonException: The JSON value could not be converted to System.Double. Path: $.FontSize | LineNumber: 0 | BytePositionInLine: 18.` |
| `{"FontSize": 12` (cut off) | `JsonException: '2' is an invalid end of a number. Expected a delimiter. Path: $.FontSize ...` |
| an empty file | `JsonException: The input does not contain any JSON tokens. ...` |
| `null` | `Deserialize` returns `null`, no exception |

The first row is the dangerous one. **By default, reading matches property names case-sensitively**, so JSON written with camelCase names doesn't match C# properties in PascalCase, and nothing complains: you just get defaults. It typically happens when the writer and the reader use different options. Use **the same options object for writing and reading**, or create options with `new JsonSerializerOptions(JsonSerializerDefaults.Web)`, which turns on camelCase naming *and* case-insensitive reading (measured: `PropertyNameCaseInsensitive` is `true` for it).

The rest make the rules for loading a file:

- Missing and unknown properties are **not** errors. That's what lets a new version of your app read an old version's file (new properties keep their defaults) and an old version read a newer one (it ignores what it doesn't know). Give every property a sensible default.
- A corrupt file throws **`JsonException`**, and a missing file throws `FileNotFoundException`. A settings loader catches both and falls back to defaults: a broken settings file should never stop the app starting.
- `Deserialize` can return **`null`**, if the file contains `null`. Treat that like a missing file.

## Saving Without Corrupting the File

`File.WriteAllText(path, text)` first empties the file, then writes. If the app crashes, the power fails or the disk fills up in between, the file is left empty or half-written, and the user's settings are gone. The standard fix is to write the new content to a **temporary file** next to it, and then **replace** the old file with the temporary one in a single step:

```dotnet
string temp = path + ".tmp";
File.WriteAllText(temp, json);
File.Move(temp, path, overwrite: true);   // the old file is replaced only once the new one is complete
```

`File.Move(source, destination, overwrite: true)` renames `source` to `destination`, replacing it (measured: afterwards the file has the new content and the `.tmp` file is gone). On the same disk, Windows performs the rename as one operation, so the settings file is always either the complete old version or the complete new one, never a mixture.

**SE lens:** Put loading and saving behind one small class (a *settings store*) with `Load()` and `Save(settings)`, and give the rest of the app a settings object, not file paths. The window saves its size and position in its `Closing` event; the theme service (level 25) saves the theme name. The store owns the folder, the file name, the JSON options and the error handling, in one place, and a test can point it at a temporary folder.

## Challenge: settings_store

Write **`SettingsStore`** in `SettingsStore.cs`. Its constructor takes the **folder** to use, and it keeps the settings in a file named **`settings.json`** in that folder.

- **`Save(AppSettings settings)`** writes the settings as JSON, creating the folder if needed, **through a temporary file** that replaces the old one;
- **`Load()`** returns the saved settings, or **new default settings** (`new AppSettings()`) when the file is missing, isn't valid JSON, or contains `null`;
- the JSON must use **camelCase** names and write `Theme` **by name**, and `Load` must read it back correctly.

```challenge console file=SettingsStore.cs
using System.Text.Json;
using System.Text.Json.Serialization;

namespace LessonApp;

public class SettingsStore
{
    public SettingsStore(string folder) { }

    public void Save(AppSettings settings) { }

    public AppSettings Load() => new AppSettings();
}
```

```challenge console file=AppSettings.cs readonly
namespace LessonApp;

public enum Theme { Light, Dark }

public class AppSettings
{
    public Theme Theme { get; set; } = Theme.Light;
    public double WindowWidth { get; set; } = 800;
    public List<string> RecentFiles { get; set; } = new();
}
```

```test
var folder = Path.Combine(Path.GetTempPath(), "settings-test-" + Guid.NewGuid().ToString("N"));
var store = new SettingsStore(folder);
assert store.Load().Theme == Theme.Light && store.Load().WindowWidth == 800   // nothing saved yet: defaults, not an exception
store.Save(new AppSettings { Theme = Theme.Dark, WindowWidth = 1024, RecentFiles = { "a.txt", "b.txt" } });
var json = File.ReadAllText(Path.Combine(folder, "settings.json"));
assert json.Contains("\"theme\"") && json.Contains("\"Dark\"") && json.Contains("\"windowWidth\"")   // camelCase names, the theme by name
var loaded = new SettingsStore(folder).Load();
assert loaded.Theme == Theme.Dark && loaded.WindowWidth == 1024 && loaded.RecentFiles.SequenceEqual(new[] { "a.txt", "b.txt" })   // a new store reads it back
assert !File.Exists(Path.Combine(folder, "settings.json.tmp")) && Directory.GetFiles(folder).Length == 1   // the temporary file is gone
File.WriteAllText(Path.Combine(folder, "settings.json"), "{\"theme\": \"Dar");
assert store.Load().Theme == Theme.Light   // a corrupt file: defaults, not an exception
File.WriteAllText(Path.Combine(folder, "settings.json"), "null");
assert store.Load() != null && store.Load().WindowWidth == 800   // a file containing null: defaults
```

## Challenge: export_shape

Another program imports orders as JSON in an agreed format. Write **`OrderExport.ToJson(Order order)`** in `OrderExport.cs`, returning exactly this shape (on one line, no indentation):

- property names in **camelCase**;
- `Status` written **by name** (`"Shipped"`), not as a number;
- properties whose value is **`null`** left out entirely;
- the order's `InternalNote` **never** written, even when it has a value.

For example, `new Order { Id = 7, Customer = "Ada", Status = OrderStatus.Shipped }` becomes `{"id":7,"customer":"Ada","status":"Shipped"}`. `JsonIgnoreCondition.WhenWritingNull`, set as the options' `DefaultIgnoreCondition`, leaves out null values; the attribute **`[JsonIgnore]`** on a property leaves that property out always. The `Order` class is yours to annotate.

```challenge console file=OrderExport.cs
using System.Text.Json;
using System.Text.Json.Serialization;

namespace LessonApp;

public enum OrderStatus { New, Shipped, Cancelled }

public class Order
{
    public int Id { get; set; }
    public string Customer { get; set; } = "";
    public OrderStatus Status { get; set; }
    public string? TrackingCode { get; set; }
    public string? InternalNote { get; set; }
}

public static class OrderExport
{
    public static string ToJson(Order order) => JsonSerializer.Serialize(order);
}
```

```test
assert OrderExport.ToJson(new Order { Id = 7, Customer = "Ada", Status = OrderStatus.Shipped }) == "{\"id\":7,\"customer\":\"Ada\",\"status\":\"Shipped\"}"
assert OrderExport.ToJson(new Order { Id = 8, Customer = "Grace", Status = OrderStatus.New, TrackingCode = "ZX9" }) == "{\"id\":8,\"customer\":\"Grace\",\"status\":\"New\",\"trackingCode\":\"ZX9\"}"   // a non-null value is kept
assert !OrderExport.ToJson(new Order { Id = 9, Customer = "Linus", InternalNote = "VIP, call first" }).Contains("VIP")   // the internal note never leaves
assert OrderExport.ToJson(new Order { Id = 0, Customer = "" }) == "{\"id\":0,\"customer\":\"\",\"status\":\"New\"}"   // zero and empty aren't null: they stay
```
