# WPF & .NET Mastery — Curriculum Plan

Status: plan (2026-10-01). Series id `wpf-mastery` in the Lesson Engine
(`src/labs/lesson-engine/content/wpf-mastery/`). Desktop app only: every example
launches a real window on the learner's own .NET SDK, and challenges are tested by
driving the learner's real UI (see `src/engine/lesson/projects/wpf.ts`).

## Who it is for, and the goal

A programmer who already writes C++ or Python and knows C# syntax (C# Fundamentals,
or equivalent), and who wants to build many real WPF applications — not copy
snippets until something works, but know *why* each piece is there.

Learners in this position say WPF feels like **tribal knowledge**: the XAML "somehow"
connects to the C#, `{Binding Name}` "somehow" finds a property, `using` lines and
project files appear from templates, and nobody explains the machinery. This course's
rule is: **nothing is magic**. Every mechanism is opened up — the code the compiler
generates is shown, the framework's lookup rules are stated, and each pattern is
introduced as the answer to a problem the learner has just hit.

Finishing the course means being able to: structure a WPF application with MVVM and
dependency injection; explain how XAML, bindings, dependency properties, resources,
styles and templates work underneath; build custom controls; keep a UI responsive with
async code; persist data in SQLite; test view models; and ship the app.

## Teaching devices used throughout

- **Show the generated code.** XAML compiles into C# (`MainWindow.g.cs`), and
  CommunityToolkit.Mvvm's attributes generate properties and commands. Lessons show
  those files, so "magic" becomes ordinary code the learner can read.
- **The same thing two ways.** Build a window in XAML, then the same window in C#; bind
  in XAML, then create the same `Binding` object in C#. XAML is shown to be a notation
  for objects, nothing more.
- **Break it on purpose.** Each lesson names the mistakes people actually make (a typo
  in a binding path, a missing `PropertyChanged`, touching a control from a background
  thread) and lets the learner see the real symptom and error text.
- **C++ / Python bridges.** Where .NET differs from what a C++ or Python programmer
  expects (namespaces vs `#include`/`import`, assemblies vs libraries/modules, the GC,
  interfaces vs duck typing), the lesson says so explicitly.
- **Patterns as answers.** Observer, command, MVVM, dependency injection, repository,
  messenger: each is introduced when the code without it has become painful.

## Dependency order

Organised by dependency, not by technology (Contract Part 2). Each module needs the
ones before it. Level numbers are the files' `level:` values.

### Module A — How a .NET application is put together (levels 0–5)
The things C++ and Python programmers find most confusing, before any WPF.

| Level | Title | Makes explicit |
|---|---|---|
| 0 | From Source Code to a Running .NET App | SDK vs runtime; `dotnet build`; IL in an assembly (`.dll`); the CLR and JIT; what's in the output folder; compare C++ compile+link and Python's interpreter |
| 1 | Namespaces, `using` and Assemblies | a namespace is a naming scope, an assembly is a file — the two are independent (unlike `#include` / `import`); implicit and global usings; how the compiler finds a type |
| 2 | Project Files and NuGet Packages | the SDK-style `.csproj`, properties (`TargetFramework`, `UseWPF`, `Nullable`), framework references, `PackageReference` and restore |
| 3 | Interfaces: How the Framework Calls Your Code | the framework is written against interfaces (`IEnumerable`, `IDisposable`, `INotifyPropertyChanged`, `ICommand`); you plug in by implementing them; compare abstract classes and duck typing |
| 4 | Attributes and Reflection | `[STAThread]`, `[Fact]`; reading types and properties at run time — exactly how `{Binding Name}` finds `Name` |
| 5 | Delegates, Events and the Observer Pattern in .NET | `EventHandler`, `sender`/`e`, subscribing and unsubscribing, memory leaks from events |

### Module B — How WPF works inside (levels 6–13)

| Level | Title | Makes explicit |
|---|---|---|
| 6 | Windows, XAML & Click Events | *(written)* XAML as objects, code-behind, StackPanel, `x:Name`, Click handlers |
| 7 | What XAML Compiles Into | `x:Class` + `partial`; the generated `MainWindow.g.cs` (shown); `InitializeComponent`, BAML, `x:Name` fields; the same window written in C# |
| 8 | Layout: Grid, DockPanel and the Layout Pass | Measure/Arrange; star and Auto sizing; alignment; margin vs padding |
| 9 | Content Models and the Two Trees | ContentControl, ItemsControl, Panel, Decorator; logical tree vs visual tree |
| 10 | Dependency Properties | why plain properties aren't enough; `DependencyProperty.Register`; value precedence; property inheritance |
| 11 | Attached Properties | how `Grid.Row="1"` works; writing your own |
| 12 | Routed Events | bubbling, tunnelling, `Preview…`, `Handled` |
| 13 | The UI Thread and the Dispatcher | STA; why touching a control from another thread throws; `Dispatcher`; `async`/`await` returning to the UI thread |

### Module C — Data binding in depth (levels 14–19)

| Level | Title | Makes explicit |
|---|---|---|
| 14 | Data Binding, Commands & MVVM | *(written)* bindings, `DataContext`, `INotifyPropertyChanged`, `ICommand`, MVVM overview |
| 15 | Binding Sources, Modes and Debugging | `ElementName`, `RelativeSource`, `Source`; modes and `UpdateSourceTrigger`; path syntax; finding binding errors |
| 16 | Value Converters and Formatting | `IValueConverter`, `StringFormat`, `MultiBinding` |
| 17 | Lists: ObservableCollection and DataTemplates | `INotifyCollectionChanged`, `ItemsControl`/`ListBox`, `ItemTemplate`, `SelectedItem` |
| 18 | Sorting, Filtering and Grouping | `ICollectionView`, `CollectionViewSource` |
| 19 | Validation | `INotifyDataErrorInfo`, validation rules, showing errors |

### Module D — Look and feel (levels 20–25)

| Level | Title | Makes explicit |
|---|---|---|
| 20 | Resources and Resource Lookup | `ResourceDictionary`; `StaticResource` vs `DynamicResource`; the lookup order; merged dictionaries |
| 21 | Styles | setters, `BasedOn`, implicit styles, why a style can't set a local value |
| 22 | Triggers and Visual States | property, data and event triggers; `VisualStateManager` |
| 23 | Control Templates: Lookless Controls | separating behaviour from looks; `TemplateBinding`; re-templating a Button |
| 24 | Data Templates by Type | implicit `DataTemplate`s, `DataTemplateSelector` — the basis of view-model navigation |
| 25 | Themes and Animation | light/dark themes with dynamic resources; storyboards |

### Module E — Application architecture (levels 26–31)

| Level | Title | Makes explicit |
|---|---|---|
| 26 | MVVM Done Properly | a view-model base class; CommunityToolkit.Mvvm `[ObservableProperty]` / `[RelayCommand]` and the code they generate (shown) |
| 27 | Async Commands | busy state, cancellation, progress, errors |
| 28 | Dependency Injection and the Generic Host | `Microsoft.Extensions.DependencyInjection`; lifetimes; composing the app at startup |
| 29 | Navigation and Dialogs | view-model-first navigation with data templates; dialogs as services |
| 30 | Messaging Between View Models | `WeakReferenceMessenger`; when to use messages vs events |
| 31 | Testing View Models | xUnit; designing for testability; fakes for services |

### Module F — Real applications (levels 32–38)

| Level | Title | Makes explicit |
|---|---|---|
| 32 | UserControls and Custom Controls | which to choose; dependency properties on your own control |
| 33 | Files, Settings and JSON | `System.Text.Json`; where an app stores its data |
| 34 | SQLite and the Repository Pattern | `Microsoft.Data.Sqlite`; async data access behind an interface |
| 35 | Performance | UI virtualization; `Freezable`; binding cost; finding slow code |
| 36 | Publishing and Deployment | `dotnet publish`; self-contained and single-file apps |
| 37 | Capstone 1: A Data-Entry App | everything in Modules A–F, end to end |
| 38 | Capstone 2: A Tool Library Manager | lists, search, editing, SQLite, DI, tests |

## Engine work the plan depends on

| Needed from | Capability | Status |
|---|---|---|
| Module B onwards | WPF project lessons: multi-file, launch, UI tests | done |
| Module A | Console project template (no WPF) | done |
| Level 7, 26 | Show the build's generated files (`*.g.cs`, source-generator output) — the **{ } Generated code** button | done |
| Levels 26–34 | NuGet packages: a fixed allow-list (CommunityToolkit.Mvvm, Microsoft.Extensions.Hosting, Microsoft.Data.Sqlite) — lessons can't add arbitrary packages | to do, with level 26 |
| Level 31 | Running an xUnit test project | to do, with level 31 |
| Module F | Saving the learner's work between sessions | to do |

## Progress

Written and verified end to end on a real .NET 10 SDK (every example built and run,
every challenge passed by a correct answer and failed by targeted wrong answers, every
quoted error built): levels 0, 1, 6, 7, 14. Verification caught two wrong claims before
publishing: a XAML error message quoted from memory (level 6), and "assemblies load
when the line runs" (level 1 — they load when the JIT compiles the method).

## Rules for writing each lesson

Contract Parts 0 and 3 apply, plus the WPF project rules in Part 4 ("Project Steps").
In particular: build every example; run every challenge with a correct answer and with
wrong answers that each break one requirement; and build any compiler error the prose
quotes rather than quoting it from memory.
